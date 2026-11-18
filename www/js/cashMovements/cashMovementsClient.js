/**
 * ==============================================================================
 * MÓDULO CLIENTE: MOVIMIENTOS ECONÓMICOS (INGRESOS Y EGRESOS)
 * ==============================================================================
 * Responsabilidades extraídas de www/js/supabaseClient.js:
 * 1. fetchCashMovements: Consulta de movimientos locales con fallback Supabase
 * 2. saveCashMovement: Registro de ingreso o egreso en Local Maestro / Supabase / Offline
 * 3. deleteCashMovement: Eliminación de movimiento
 * 4. registerCashMovement: Movimiento en turno activo vía RPC o API local
 * ==============================================================================
 */

(function (global) {
  const CashMovementsClient = {
    /**
     * Consulta los movimientos económicos adicionales (Ingresos y Egresos)
     * Backend Local Maestro primero, fallback Supabase
     */
    async fetchCashMovements(terminalCode = null, clientContext = null) {
      const getClient = () => clientContext?.getClient?.() || (typeof global.PosDataService !== 'undefined' ? global.PosDataService.getClient() : null);
      const doLocalApi = (typeof global.localApi === 'function') 
        ? global.localApi 
        : (clientContext?.localApi || (async () => ({ ok: false, networkError: true })));

      // 1. Intentar Backend Local Maestro
      const url = terminalCode && terminalCode !== 'all'
        ? `/cash-movements?terminal=${encodeURIComponent(terminalCode)}`
        : '/cash-movements';
      const local = await doLocalApi(url);
      if (local.ok && local.data && Array.isArray(local.data.movements)) {
        return local.data.movements;
      }

      // 2. Fallback Supabase
      const client = getClient();
      if (client) {
        try {
          let query = client.from('cash_movements').select('*').order('created_at', { ascending: false });
          if (terminalCode && terminalCode !== 'all') {
            query = query.eq('terminal_code', terminalCode);
          }
          const { data, error } = await query;
          if (!error && Array.isArray(data)) {
            return data;
          }
        } catch (err) {
          console.warn('Error en fallback Supabase cash_movements:', err);
        }
      }

      return [];
    },

    /**
     * Guarda un movimiento económico (Ingreso o Egreso)
     * Backend Local Maestro primero, fallback Supabase
     */
    async saveCashMovement(movementPayload, clientContext = null) {
      const getClient = () => clientContext?.getClient?.() || (typeof global.PosDataService !== 'undefined' ? global.PosDataService.getClient() : null);
      const doLocalApi = (typeof global.localApi === 'function') 
        ? global.localApi 
        : (clientContext?.localApi || (async () => ({ ok: false, networkError: true })));

      const sanitized = { ...movementPayload };
      // Normalizar método de pago para que coincida con los CHECK constraints de la base de datos
      if (!['cash', 'card', 'transfer'].includes(sanitized.payment_method)) {
        sanitized.payment_method = 'transfer';
      }

      // 1. Intentar Backend Local Maestro
      const local = await doLocalApi('/cash-movements', {
        method: 'POST',
        body: JSON.stringify(sanitized)
      });
      if (local.ok && local.data && local.data.ok) {
        return local.data;
      }
      if (local.data && local.data.error && !local.networkError) {
        return { ok: false, error: local.data.error };
      }

      // 2. Fallback Supabase
      const client = getClient();
      if (client) {
        try {
          const { data, error } = await client
            .from('cash_movements')
            .insert([sanitized])
            .select();
          if (error) {
            console.warn('Advertencia insertando en Supabase cash_movements:', error.message);
          } else {
            return { ok: true, id: data?.[0]?.id, movement: data?.[0] };
          }
        } catch (err) {
          console.warn('Error en fallback Supabase cash_movements:', err.message);
        }
      }

      // 3. Fallback Local Offline Seguro:
      // Nunca perder un movimiento económico en el POS (generador de ID único sin colisión)
      if (!global._cashMovOfflineSeq) global._cashMovOfflineSeq = 0;
      const offlineId = Date.now() * 1000 + ((++global._cashMovOfflineSeq) % 1000);
      const offlineRecord = {
        id: offlineId,
        ...sanitized,
        offline: true,
        created_at: sanitized.created_at || new Date().toISOString()
      };
      return { ok: true, id: offlineId, movement: offlineRecord, offline: true };
    },

    /**
     * Elimina un movimiento económico
     * Backend Local Maestro primero, fallback Supabase
     */
    async deleteCashMovement(id, clientContext = null) {
      const getClient = () => clientContext?.getClient?.() || (typeof global.PosDataService !== 'undefined' ? global.PosDataService.getClient() : null);
      const doLocalApi = (typeof global.localApi === 'function') 
        ? global.localApi 
        : (clientContext?.localApi || (async () => ({ ok: false, networkError: true })));

      // 1. Intentar Backend Local Maestro
      const local = await doLocalApi(`/cash-movements/${id}`, {
        method: 'DELETE'
      });
      if (local.ok && local.data && local.data.ok) {
        return local.data;
      }

      // 2. Fallback Supabase
      const client = getClient();
      if (client) {
        try {
          const { error } = await client.from('cash_movements').delete().eq('id', id);
          if (error) return { ok: false, error: error.message };
          return { ok: true };
        } catch (err) {
          return { ok: false, error: err.message };
        }
      }

      return { ok: false, error: 'Sin conexión para eliminar movimiento.' };
    },

    /**
     * Registra un movimiento de efectivo
     */
    async registerCashMovement(terminalCode, movementType, amount, concept = '', clientContext = null) {
      const getClient = () => clientContext?.getClient?.() || (typeof global.PosDataService !== 'undefined' ? global.PosDataService.getClient() : null);
      const doLocalApi = (typeof global.localApi === 'function') 
        ? global.localApi 
        : (clientContext?.localApi || (async () => ({ ok: false, networkError: true })));

      // 1. Intentar Backend Local Maestro
      const local = await doLocalApi('/shift/movement', {
        method: 'POST',
        body: JSON.stringify({
          terminal_code: terminalCode,
          movement_type: movementType,
          amount: parseFloat(amount) || 0,
          concept: concept || ''
        })
      });
      if (local.ok && local.data && local.data.ok) {
        return local.data;
      }
      if (local.data && local.data.error && !local.networkError) {
        return { ok: false, error: local.data.error };
      }

      // 2. Fallback Supabase
      const client = getClient();
      if (client) {
        try {
          const { data, error } = await client.rpc('register_cash_movement', {
            p_terminal_code: terminalCode,
            p_movement_type: movementType,
            p_amount: parseFloat(amount) || 0,
            p_concept: concept || ''
          });
          if (error) return { ok: false, error: error.message };
          return data;
        } catch (err) {
          return { ok: false, error: err.message };
        }
      }
      return { ok: false, error: 'Sin conexión para registrar movimiento.' };
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CashMovementsClient;
  }
  if (typeof window !== 'undefined') {
    window.CashMovementsClient = CashMovementsClient;
  }
})(typeof window !== 'undefined' ? window : global);
