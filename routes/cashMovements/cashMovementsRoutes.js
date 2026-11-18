/**
 * ==============================================================================
 * ENPOINTS & CONTROLADOR: MOVIMIENTOS DE CAJA (INGRESOS Y EGRESOS)
 * ==============================================================================
 * Responsabilidades extraídas de server.js:
 * 1. POST /api/pos/shift/movement -> Registrar movimiento en turno activo
 * 2. GET  /api/pos/cash-movements -> Listar movimientos con fallback de Supabase
 * 3. POST /api/pos/cash-movements -> Crear movimiento en SQLite y respaldo en Supabase
 * 4. DELETE /api/pos/cash-movements/:id -> Eliminar movimiento en SQLite y Supabase
 * ==============================================================================
 */

const express = require('express');

function createCashMovementsRouter({ localDb, supabase, resolveRequestUser }) {
  const router = express.Router();

  // 1. Movimientos extraordinarios de efectivo en turno activo
  router.post('/shift/movement', (req, res) => {
    try {
      const user = resolveRequestUser(req);
      const { terminal_code, movement_type, amount, concept } = req.body || {};
      const result = localDb.registerCashMovement(terminal_code, movement_type, amount, concept, user);
      res.json(result);
    } catch (err) {
      const status = err instanceof localDb.PosError ? err.status : 500;
      res.status(status).json({ ok: false, error: err.message, errorCode: err.code });
    }
  });

  // 2. Consulta de movimientos de caja (sincronizados con Supabase)
  router.get('/cash-movements', async (req, res) => {
    try {
      const terminal = req.query.terminal || null;
      const cutId = req.query.cut_id || null;
      const limit = parseInt(req.query.limit, 10) || 500;

      let movements = localDb.getCashMovements({ terminal, cash_cut_id: cutId, limit });

      // Si local está vacío pero hay conexión a Supabase, sincronizar hacia local
      if ((!movements || movements.length === 0) && supabase) {
        try {
          let query = supabase.from('cash_movements').select('*').order('created_at', { ascending: false });
          if (terminal && terminal !== 'all') query = query.eq('terminal_code', terminal);
          if (limit) query = query.limit(limit);
          const { data, error } = await query;
          if (!error && Array.isArray(data) && data.length > 0) {
            for (const m of data) {
              try { localDb.saveCashMovement(m, { full_name: m.user_name || 'Admin' }); } catch (_) {}
            }
            movements = localDb.getCashMovements({ terminal, cash_cut_id: cutId, limit });
          }
        } catch (cloudErr) {
          console.warn('Advertencia consultando cash_movements en Supabase:', cloudErr.message);
        }
      }

      res.json({ ok: true, count: movements.length, movements });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // 3. Registrar movimiento económico (ingreso o egreso)
  router.post('/cash-movements', async (req, res) => {
    try {
      const user = resolveRequestUser(req);
      const mov = req.body || {};
      const localResult = localDb.saveCashMovement(mov, user);

      if (supabase && localResult.movement) {
        try {
          const payloadToCloud = { ...localResult.movement };
          delete payloadToCloud.rev;
          delete payloadToCloud.synced_rev;
          const { error: upErr } = await supabase.from('cash_movements').upsert([payloadToCloud], { onConflict: 'id' });
          if (upErr && /column|schema cache/i.test(upErr.message)) {
            await supabase.from('cash_movements').upsert([{
              id: payloadToCloud.id,
              cash_cut_id: payloadToCloud.cash_cut_id,
              terminal_code: payloadToCloud.terminal_code,
              movement_type: payloadToCloud.movement_type,
              amount: payloadToCloud.amount,
              concept: payloadToCloud.concept,
              user_name: payloadToCloud.user_name,
              created_at: payloadToCloud.created_at,
              updated_at: payloadToCloud.updated_at
            }], { onConflict: 'id' });
          }
        } catch (cloudErr) {
          console.warn('Advertencia respaldando movimiento en Supabase (se sincronizará en respaldo periódico):', cloudErr.message);
        }
      }

      res.json({ ok: true, id: localResult.id, movement: localResult.movement });
    } catch (err) {
      const status = err instanceof localDb.PosError ? err.status : 500;
      res.status(status).json({ ok: false, error: err.message, errorCode: err.code });
    }
  });

  // 4. Eliminar movimiento económico
  router.delete('/cash-movements/:id', async (req, res) => {
    try {
      const id = req.params.id;
      if (supabase) {
        try {
          await supabase.from('cash_movements').delete().eq('id', id);
        } catch (cloudErr) {
          console.warn('Advertencia eliminando movimiento en Supabase:', cloudErr.message);
        }
      }
      localDb.deleteCashMovement(id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
}

module.exports = createCashMovementsRouter;
