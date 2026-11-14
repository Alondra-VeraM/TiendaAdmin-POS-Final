/**
 * SUPABASE CLIENT & DATA LAYER
 * Conexión nativa con Supabase (PostgreSQL) para NEXUS Retail POS
 * Fuente principal de verdad y sincronización multi-terminal (Caja 1 y Caja 2).
 */

// Utilidades seguras de almacenamiento local
function safeGetStorage(key) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch (e) {}
  return null;
}

function safeSetStorage(key, val) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, val);
    }
  } catch (e) {}
}

// Catálogo base de referencia (utilizado como fallback mientras carga la red inicial)
const INITIAL_INVENTORY = [
  { id: 1, barcode: '7501820511234', sku: '7501820511234', name: 'Leche Lala Entera 1L', category: 'Lácteos y Cremería', cost: 22.50, price: 29.50, stock: 34, iconType: 'milk' },
  { id: 2, barcode: '750185538472', sku: '750185538472', name: 'Coca-Cola Original 600ml', category: 'Bebidas y Refrescos', cost: 14.00, price: 19.00, stock: 42, iconType: 'soda' },
  { id: 3, barcode: '750103912089', sku: '750103912089', name: 'Aceite Nutrioli 850ml', category: 'Abarrotes y Granos', cost: 36.00, price: 45.00, stock: 4, iconType: 'general' },
  { id: 4, barcode: '750188881235', sku: '750188881235', name: 'Huevo Blanco San Juan 1kg', category: 'Abarrotes y Granos', cost: 42.00, price: 52.00, stock: 15, iconType: 'egg' },
  { id: 5, barcode: '750954123456', sku: '750954123456', name: 'Pan Bimbo Blanco 680g', category: 'Panadería', cost: 28.00, price: 38.00, stock: 0, iconType: 'bread' },
  { id: 6, barcode: '750321654789', sku: '750321654789', name: 'Manzana Roja 1kg', category: 'Frutas y Verduras', cost: 25.00, price: 35.00, stock: 50, iconType: 'general' },
  { id: 7, barcode: '750741852963', sku: '750741852963', name: 'Arroz Morelos 1kg', category: 'Abarrotes y Granos', cost: 18.00, price: 26.00, stock: 3, iconType: 'general' },
  { id: 8, barcode: '750369258147', sku: '750369258147', name: 'Frijol Pinto 1kg', category: 'Abarrotes y Granos', cost: 22.00, price: 32.00, stock: 27, iconType: 'general' },
  { id: 9, barcode: '750147258369', sku: '750147258369', name: 'Sabritas Original 45g', category: 'Botanas', cost: 10.00, price: 15.00, stock: 60, iconType: 'general' },
  { id: 10, barcode: '750258369147', sku: '750258369147', name: 'Jabón Zote 200g', category: 'Limpieza e Higiene', cost: 8.00, price: 12.00, stock: 5, iconType: 'general' },
  { id: 11, barcode: '750369147258', sku: '750369147258', name: 'Papel Higiénico Suavel 4 rollos', category: 'Limpieza e Higiene', cost: 20.00, price: 32.00, stock: 18, iconType: 'general' },
  { id: 12, barcode: '750456789321', sku: '750456789321', name: 'Agua Ciel 1.5L', category: 'Bebidas y Refrescos', cost: 12.00, price: 16.00, stock: 33, iconType: 'general' }
];

const INITIAL_SALES_HISTORY = [];

let supabaseClientInstance = null;
let isSupabaseConnected = false;

function initSupabaseClient() {
  if (supabaseClientInstance) return supabaseClientInstance;

  const config = (typeof window.getAppConfig === 'function') 
    ? window.getAppConfig() 
    : {
        supabaseUrl: window.ENV_CONFIG && window.ENV_CONFIG.SUPABASE_URL,
        supabaseAnonKey: window.ENV_CONFIG && window.ENV_CONFIG.SUPABASE_ANON_KEY
      };

  let url = config.supabaseUrl || '';
  if (url.endsWith('/rest/v1')) url = url.replace('/rest/v1', '');
  if (url.endsWith('/rest/v1/')) url = url.replace('/rest/v1/', '');
  if (url.endsWith('/')) url = url.slice(0, -1);

  const key = config.supabaseAnonKey;

  if (url && key && url.includes('supabase.co')) {
    try {
      const createFn = (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function')
        ? window.supabase.createClient
        : (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function' ? supabase.createClient : null);

      if (createFn) {
        supabaseClientInstance = createFn(url, key);
        isSupabaseConnected = true;
        updateSyncIndicator(true);
        return supabaseClientInstance;
      }
    } catch (e) {
      console.warn('No se pudo inicializar cliente Supabase:', e);
    }
  }

  isSupabaseConnected = false;
  updateSyncIndicator(false);
  return null;
}

function updateSyncIndicator(online) {
  const statusDot = document.querySelector('.dot-sync-green');
  const statusText = document.querySelector('.sync-status-text');
  if (statusText) {
    statusText.textContent = online ? 'Supabase Nube (En línea)' : 'Sin Conexión (Revisar Red)';
  }
  if (statusDot) {
    statusDot.style.backgroundColor = online ? '#10b981' : '#ef4444';
  }
}

// Intentar inicialización inmediata
initSupabaseClient();

const PosDataService = {
  getClient() {
    if (!supabaseClientInstance) initSupabaseClient();
    return supabaseClientInstance;
  },

  isConnected() {
    return isSupabaseConnected && !!this.getClient();
  },

  /**
   * Consulta directa al catálogo de productos en Supabase (Fuente de verdad compartida)
   */
  async fetchProducts() {
    const client = this.getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (!error && Array.isArray(data) && data.length > 0) {
          const formatted = data.map(p => ({
            id: p.id,
            barcode: p.barcode,
            sku: p.sku || p.barcode,
            name: p.name,
            displayName: p.display_name || p.name,
            category: p.category,
            cost: parseFloat(p.cost || 0),
            price: parseFloat(p.price || 0),
            stock: parseInt(p.stock, 10) || 0,
            iconType: p.icon_type || 'bread',
            promoRule: p.promo_rule || null
          }));

          safeSetStorage('pos_inventory_products', JSON.stringify(formatted));
          isSupabaseConnected = true;
          updateSyncIndicator(true);
          return formatted;
        }
      } catch (err) {
        console.warn('Error consultando productos de Supabase:', err);
      }
    }

    return this.getInventoryProducts();
  },

  getInventoryProducts() {
    const stored = safeGetStorage('pos_inventory_products');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {}
    }
    return JSON.parse(JSON.stringify(INITIAL_INVENTORY));
  },

  /**
   * Consulta el estado del turno para la terminal indicada (C1 o C2)
   */
  async getTerminalShift(terminalCode) {
    const code = terminalCode || (typeof window.getActiveTerminal === 'function' ? window.getActiveTerminal().code : 'C1');
    const client = this.getClient();

    if (client) {
      try {
        const { data, error } = await client.rpc('get_terminal_shift', {
          p_terminal_code: code
        });

        if (!error && data) {
          isSupabaseConnected = true;
          updateSyncIndicator(true);
          safeSetStorage(`pos_shift_${code}`, JSON.stringify(data));
          return data;
        }
        if (error) {
          console.warn('Error RPC get_terminal_shift:', error.message);
        }
      } catch (err) {
        console.warn('Fallo de red al consultar turno de terminal:', err);
        isSupabaseConnected = false;
        updateSyncIndicator(false);
      }
    }

    // Fallback de caché local si la red falla
    const cached = safeGetStorage(`pos_shift_${code}`);
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }

    return { is_open: false, terminal_code: code, error: 'Sin conexión con Supabase' };
  },

  /**
   * Abre un nuevo turno en Supabase
   */
  async openTerminalShift(terminalCode, terminalName, cashierName, initialFund = 1000.00) {
    const client = this.getClient();
    if (!client) {
      return { ok: false, error: 'No hay conexión con Supabase para abrir el turno.' };
    }

    try {
      const { data, error } = await client.rpc('open_terminal_shift', {
        p_terminal_code: terminalCode,
        p_terminal_name: terminalName,
        p_cashier_name: cashierName || 'Cajero',
        p_initial_fund: parseFloat(initialFund) || 1000.00
      });

      if (error) {
        return { ok: false, error: error.message };
      }

      if (data && data.ok) {
        safeSetStorage(`pos_shift_${terminalCode}`, JSON.stringify({ is_open: true, shift: data.shift }));
        return data;
      }
      return data || { ok: false, error: 'Respuesta inválida al abrir turno' };
    } catch (err) {
      return { ok: false, error: 'Error de red al abrir turno: ' + err.message };
    }
  },

  /**
   * Cierra el turno activo y guarda permanentemente el corte de caja en Supabase
   */
  async closeTerminalShift(terminalCode, countedCash, notes = null, cashInflows = 0, cashOutflows = 0, supplierPayouts = 0) {
    const client = this.getClient();
    if (!client) {
      return { ok: false, error: 'No hay conexión con Supabase para cerrar el turno y guardar el corte.' };
    }

    try {
      const { data, error } = await client.rpc('close_terminal_shift', {
        p_terminal_code: terminalCode,
        p_counted_cash: parseFloat(countedCash) || 0,
        p_notes: notes,
        p_cash_inflows: parseFloat(cashInflows) || 0,
        p_cash_outflows: parseFloat(cashOutflows) || 0,
        p_supplier_payouts: parseFloat(supplierPayouts) || 0
      });

      if (error) {
        return { ok: false, error: error.message };
      }

      if (data && data.ok) {
        safeSetStorage(`pos_shift_${terminalCode}`, JSON.stringify({ is_open: false, last_shift: data.shift }));
        return data;
      }
      return data || { ok: false, error: 'Respuesta inválida al cerrar turno' };
    } catch (err) {
      return { ok: false, error: 'Error de red al cerrar turno: ' + err.message };
    }
  },

  /**
   * Registra una venta de forma atómica en Supabase:
   * Valida turno abierto, bloquea filas de producto para evitar sobreventas concurrentes,
   * valida existencias, descuenta inventario y asocia la venta al turno.
   */
  async registerSale(salePayload, items = []) {
    const client = this.getClient();
    if (!client) {
      return {
        success: false,
        error: 'Sin conexión con el servidor Supabase. No se puede procesar la venta sin persistencia.'
      };
    }

    try {
      const terminalInfo = typeof window.getActiveTerminal === 'function' ? window.getActiveTerminal() : { code: 'C1', name: 'Caja 1' };
      const terminalCode = salePayload.terminal_code || terminalInfo.code || 'C1';
      const terminalName = salePayload.terminal_name || terminalInfo.name || 'Caja 1';

      // Sanitizar ítems para asegurar que sólo IDs reales de la BD se envíen como numéricos (evitar timestamps o colisiones)
      const formattedItems = items.map(it => {
        let validDbId = null;
        if (typeof it.id === 'number' && Number.isInteger(it.id) && it.id > 0 && it.id < 1000000000) {
          validDbId = it.id;
        } else if (typeof it.id === 'string' && /^\d+$/.test(it.id)) {
          const parsed = parseInt(it.id, 10);
          if (parsed > 0 && parsed < 1000000000) validDbId = parsed;
        }

        const cleanBarcode = (it.barcode || it.sku || '').toString().trim();
        const cleanSku = (it.sku || it.barcode || '').toString().trim();
        const cleanName = (it.name || it.displayName || 'Artículo').toString().trim();

        return {
          id: validDbId,
          barcode: cleanBarcode,
          sku: cleanSku,
          name: cleanName,
          unitPrice: parseFloat(it.unitPrice || it.price || 0),
          quantity: parseInt(it.quantity, 10) || 1,
          discount: parseFloat(it.discount || 0),
          subtotal: parseFloat(it.subtotal || ((it.unitPrice || it.price || 0) * (it.quantity || 1))),
          promo_applied: it.promoRule ? JSON.stringify(it.promoRule) : null
        };
      });

      const { data, error } = await client.rpc('register_sale_atomic', {
        p_folio: salePayload.folio,
        p_terminal_code: terminalCode,
        p_terminal_name: terminalName,
        p_cashier_name: salePayload.cashier_name || 'Cajero',
        p_subtotal: parseFloat(salePayload.subtotal || salePayload.total_net || 0),
        p_discount: parseFloat(salePayload.discount || 0),
        p_total_net: parseFloat(salePayload.total_net || 0),
        p_payment_method: salePayload.payment_method || 'cash',
        p_cash_received: salePayload.cash_received != null ? parseFloat(salePayload.cash_received) : null,
        p_cash_change: salePayload.cash_change != null ? parseFloat(salePayload.cash_change) : null,
        p_cash_amount: salePayload.cash_amount != null ? parseFloat(salePayload.cash_amount) : null,
        p_card_amount: salePayload.card_amount != null ? parseFloat(salePayload.card_amount) : null,
        p_transfer_amount: salePayload.transfer_amount != null ? parseFloat(salePayload.transfer_amount) : null,
        p_items: formattedItems
      });

      if (error) {
        console.error('[Supabase RPC register_sale_atomic Error]:', error);
        return { success: false, error: error.message || 'Error de base de datos al registrar venta' };
      }

      if (data && data.ok) {
        if (data.duplicate) {
          console.warn('[POS] Folio duplicado prevenido por RPC:', data);
          return {
            success: false,
            duplicate: true,
            error: 'El folio "' + salePayload.folio + '" ya fue registrado previamente en la base de datos.',
            errorCode: 'DUPLICATE_FOLIO'
          };
        }

        // Refrescar inventario localmente tras la venta exitosa
        await this.fetchProducts();
        return { success: true, result: data, duplicate: false };
      }

      console.warn('[Supabase RPC register_sale_atomic Failed]:', data);
      return {
        success: false,
        error: data?.error || 'No se pudo completar la venta',
        errorCode: data?.error_code
      };
    } catch (err) {
      console.error('Error registrando venta en Supabase:', err);
      return {
        success: false,
        error: 'Error de conexión con Supabase al registrar venta: ' + err.message
      };
    }
  },

  /**
   * Consulta el historial de ventas desde Supabase
   */
  async fetchSales(limit = 100, terminalCode = null) {
    const client = this.getClient();
    if (client) {
      try {
        let query = client
          .from('sales')
          .select('*, sale_items(*)')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (terminalCode && terminalCode !== 'all') {
          query = query.eq('terminal_code', terminalCode);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          // Adaptar formato esperado por el frontend
          const formatted = data.map(s => {
            const dt = new Date(s.created_at);
            const pad = (n) => String(n).padStart(2, '0');
            const timeStr = !isNaN(dt.getTime()) ? `${pad(dt.getHours())}:${pad(dt.getMinutes())} hrs` : '--:--';
            const itemsList = Array.isArray(s.sale_items) ? s.sale_items : [];
            const itemsSummaryText = `${s.total_pieces || itemsList.length} producto${(s.total_pieces || itemsList.length) === 1 ? '' : 's'}`;
            const itemsDetailText = itemsList.map(it => `${it.product_name} x${it.quantity}`).join(', ');

            return {
              id: s.id,
              folio: s.folio,
              date: timeStr,
              created_at: s.created_at,
              cajaCode: s.terminal_code || 'C1',
              cajaName: s.terminal_name || 'Caja 1',
              cashier: s.cashier_name || 'Cajero',
              itemsCount: s.total_pieces || itemsList.length,
              itemsSummary: itemsSummaryText,
              itemsDetail: itemsDetailText,
              items: itemsList.map(it => ({
                name: it.product_name,
                quantity: it.quantity,
                unitPrice: parseFloat(it.unit_price || 0),
                total: parseFloat(it.subtotal || 0)
              })),
              paymentMethod: s.payment_method,
              cashAmount: parseFloat(s.cash_amount || 0),
              cardAmount: parseFloat(s.card_amount || 0),
              transferAmount: parseFloat(s.transfer_amount || 0),
              total: parseFloat(s.total_net || 0),
              status: s.status || 'completed'
            };
          });

          safeSetStorage('pos_sales_history', JSON.stringify(formatted));
          return formatted;
        }
      } catch (err) {
        console.warn('Error al consultar ventas de Supabase:', err);
      }
    }

    return this.getSalesHistory();
  },

  getSalesHistory() {
    const stored = safeGetStorage('pos_sales_history');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  },

  /**
   * Consulta la suma y desglose de todo lo del día actual directamente desde la base de datos
   */
  async getDailySalesSummary(terminalCode = 'all') {
    const client = this.getClient();
    if (!client) {
      return { ok: false, error: 'Sin conexión con Supabase para consultar resumen diario.' };
    }
    try {
      const { data, error } = await client.rpc('get_daily_sales_summary', {
        p_terminal_code: terminalCode || 'all'
      });
      if (error) {
        console.warn('Error en get_daily_sales_summary:', error);
        return { ok: false, error: error.message };
      }
      return data;
    } catch (err) {
      console.warn('Error llamando a get_daily_sales_summary:', err);
      return { ok: false, error: err.message };
    }
  },

  /**
   * Registra un movimiento de caja (entrada, salida, pago proveedor) en la base de datos
   */
  async registerCashMovement(terminalCode, movementType, amount, concept = '') {
    const client = this.getClient();
    if (!client) {
      return { ok: false, error: 'Sin conexión con Supabase para registrar movimiento de caja.' };
    }
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
  },

  /**
   * Consulta cortes de caja históricos para reportes de varios días
   */
  async fetchReports(startDate, endDate, terminalCode = 'all') {
    const client = this.getClient();
    if (!client) {
      return { ok: false, error: 'Sin conexión con Supabase para consultar reportes.' };
    }

    try {
      let query = client.from('cash_cuts').select('*');

      if (startDate) {
        // Asegurar inicio del día local en formato ISO
        const startIso = (startDate.includes('T')) ? startDate : `${startDate}T00:00:00.000Z`;
        query = query.gte('opened_at', startIso);
      }

      if (endDate) {
        // Asegurar fin del día local en formato ISO
        const endIso = (endDate.includes('T')) ? endDate : `${endDate}T23:59:59.999Z`;
        query = query.lte('opened_at', endIso);
      }

      if (terminalCode && terminalCode !== 'all') {
        query = query.eq('terminal_code', terminalCode);
      }

      query = query.order('opened_at', { ascending: false });

      const { data, error } = await query;
      if (error) {
        return { ok: false, error: error.message };
      }

      const cuts = Array.isArray(data) ? data : [];

      // Calcular acumulados de forma segura
      let totalSalesCount = 0;
      let totalSalesAmount = 0;
      let totalCashSales = 0;
      let totalCardSales = 0;
      let totalTransferSales = 0;
      let totalMixedSales = 0;
      let totalInflows = 0;
      let totalOutflows = 0;
      let totalSupplier = 0;
      let totalInitialFunds = 0;
      let totalCountedCash = 0;
      let totalExpectedCash = 0;
      let totalDifference = 0;

      cuts.forEach(c => {
        totalSalesCount += parseInt(c.total_sales_count || 0, 10);
        totalSalesAmount += parseFloat(c.total_sales_amount || 0);
        totalCashSales += parseFloat(c.cash_sales || 0);
        totalCardSales += parseFloat(c.card_sales || 0);
        totalTransferSales += parseFloat(c.transfer_sales || c.qr_sales || 0);
        totalMixedSales += parseFloat(c.mixed_sales || 0);
        totalInflows += parseFloat(c.cash_inflows || 0);
        totalOutflows += parseFloat(c.cash_outflows || 0);
        totalSupplier += parseFloat(c.supplier_payouts || 0);
        totalInitialFunds += parseFloat(c.initial_fund || 0);
        totalCountedCash += parseFloat(c.counted_cash || 0);
        totalExpectedCash += parseFloat(c.expected_cash || 0);
        totalDifference += parseFloat(c.difference || 0);
      });

      return {
        ok: true,
        cuts,
        totals: {
          cutsCount: cuts.length,
          totalSalesCount,
          totalSalesAmount,
          totalCashSales,
          totalCardSales,
          totalTransferSales,
          totalMixedSales,
          totalInflows,
          totalOutflows,
          totalSupplier,
          totalInitialFunds,
          totalCountedCash,
          totalExpectedCash,
          totalDifference
        }
      };
    } catch (err) {
      return { ok: false, error: 'Error al consultar reportes: ' + err.message };
    }
  },

  /**
   * Guarda o actualiza un producto en Supabase
   */
  async saveProduct(product) {
    const client = this.getClient();
    if (client) {
      try {
        const payload = {
          barcode: product.barcode,
          sku: product.sku || product.barcode,
          name: product.name,
          display_name: product.displayName || product.name,
          category: product.category || 'General',
          cost: parseFloat(product.cost || 0),
          price: parseFloat(product.price || 0),
          stock: parseInt(product.stock, 10) || 0,
          is_active: true
        };

        if (product.id && !isNaN(product.id)) {
          payload.id = Number(product.id);
        }

        const { data, error } = await client
          .from('products')
          .upsert(payload, { onConflict: 'barcode' })
          .select()
          .single();

        if (!error && data) {
          product.id = data.id;
          await this.fetchProducts();
          return product;
        }
      } catch (e) {
        console.warn('Error guardando producto en Supabase:', e);
      }
    }

    // Fallback local
    const prods = this.getInventoryProducts().filter(p => p.barcode !== product.barcode);
    prods.unshift(product);
    safeSetStorage('pos_inventory_products', JSON.stringify(prods));
    return product;
  },

  /**
   * Desactiva un producto en Supabase
   */
  async deleteProduct(productId) {
    const client = this.getClient();
    if (client) {
      try {
        await client
          .from('products')
          .update({ is_active: false })
          .eq('id', productId);
      } catch (e) {}
    }
    const products = this.getInventoryProducts().filter(p => p.id !== productId);
    safeSetStorage('pos_inventory_products', JSON.stringify(products));
  },

  saveInventoryProducts(products) {
    safeSetStorage('pos_inventory_products', JSON.stringify(products));
    return products;
  },

  /**
   * Busca producto por código de barras o SKU
   */
  async findProductByBarcode(code) {
    if (!code) return null;
    const cleanCode = code.trim().toLowerCase();

    const client = this.getClient();
    if (client) {
      try {
        let { data, error } = await client
          .from('products')
          .select('*')
          .eq('is_active', true)
          .or(`barcode.eq.${cleanCode},sku.eq.${cleanCode}`)
          .maybeSingle();

        if (!data) {
          const { data: nameMatch } = await client
            .from('products')
            .select('*')
            .eq('is_active', true)
            .ilike('name', `%${cleanCode}%`)
            .limit(1)
            .maybeSingle();
          data = nameMatch;
        }

        if (!error && data) {
          return {
            id: data.id,
            sku: data.sku || data.barcode,
            barcode: data.barcode,
            name: data.name,
            displayName: data.display_name || data.name,
            unitPrice: parseFloat(data.price),
            category: data.category,
            stock: data.stock,
            iconType: data.icon_type || 'bread',
            promoRule: data.promo_rule || null
          };
        }
      } catch (err) {}
    }

    const invList = this.getInventoryProducts();
    const invMatch = invList.find(p => 
      (p.barcode && p.barcode.toLowerCase() === cleanCode) || 
      (p.sku && p.sku.toLowerCase() === cleanCode) || 
      (p.name && p.name.toLowerCase().includes(cleanCode))
    );

    if (invMatch) {
      return {
        id: invMatch.id,
        sku: invMatch.barcode || invMatch.sku,
        barcode: invMatch.barcode,
        name: invMatch.name,
        displayName: invMatch.name,
        unitPrice: parseFloat(invMatch.price),
        category: invMatch.category,
        stock: invMatch.stock,
        iconType: invMatch.iconType || 'bread',
        promoRule: invMatch.promoRule || null
      };
    }

    if (typeof window !== 'undefined' && Array.isArray(window.MEXICO_BARCODES)) {
      const mb = window.MEXICO_BARCODES.find(p => 
        (p.barcode && p.barcode.toLowerCase() === cleanCode) || 
        (p.name && p.name.toLowerCase() === cleanCode)
      );
      if (mb) {
        return {
          id: 'mb_' + mb.barcode,
          sku: mb.barcode,
          barcode: mb.barcode,
          name: mb.name,
          displayName: mb.name,
          unitPrice: parseFloat(mb.price),
          category: mb.category,
          stock: 50,
          iconType: 'bread',
          promoRule: null
        };
      }
    }

    return null;
  },

  /**
   * Búsqueda predictiva de productos en tiempo real
   */
  async searchProducts(term) {
    if (!term || !term.trim()) return [];
    const cleanTerm = term.trim().toLowerCase();
    const matches = [];

    const client = this.getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('products')
          .select('*')
          .eq('is_active', true)
          .or(`barcode.ilike.%${cleanTerm}%,sku.ilike.%${cleanTerm}%,name.ilike.%${cleanTerm}%,category.ilike.%${cleanTerm}%`)
          .limit(15);

        if (!error && data && data.length > 0) {
          data.forEach(item => {
            matches.push({
              id: item.id,
              barcode: item.barcode,
              sku: item.sku || item.barcode,
              name: item.name,
              displayName: item.display_name || item.name,
              price: parseFloat(item.price || 0),
              unitPrice: parseFloat(item.price || 0),
              category: item.category || 'General',
              stock: parseInt(item.stock || 0, 10),
              iconType: item.icon_type || 'bread',
              promoRule: item.promo_rule || null
            });
          });
        }
      } catch (e) {}
    }

    const localList = this.getInventoryProducts() || [];
    localList.forEach(item => {
      const bcode = String(item.barcode || '').toLowerCase();
      const sku = String(item.sku || '').toLowerCase();
      const name = String(item.name || '').toLowerCase();
      const cat = String(item.category || '').toLowerCase();

      if (bcode.includes(cleanTerm) || sku.includes(cleanTerm) || name.includes(cleanTerm) || cat.includes(cleanTerm)) {
        if (!matches.some(m => m.id === item.id || m.barcode === item.barcode)) {
          matches.push({
            id: item.id,
            barcode: item.barcode,
            sku: item.sku || item.barcode,
            name: item.name,
            displayName: item.displayName || item.name,
            price: parseFloat(item.price || 0),
            unitPrice: parseFloat(item.price || 0),
            category: item.category || 'General',
            stock: parseInt(item.stock || 0, 10),
            iconType: item.iconType || 'bread',
            promoRule: item.promoRule || null
          });
        }
      }
    });

    matches.sort((a, b) => {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      const aStarts = aName.startsWith(cleanTerm);
      const bStarts = bName.startsWith(cleanTerm);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return aName.localeCompare(bName);
    });

    return matches.slice(0, 8);
  },

  /**
   * Cancelación de venta y restitución de existencias
   */
  async cancelSale(ticketFolio, adminName = 'Administrador') {
    const client = this.getClient();
    if (client) {
      try {
        const { error } = await client
          .from('sales')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancelled_by: adminName,
            cancellation_reason: 'Cancelación autorizada en punto de venta'
          })
          .eq('folio', ticketFolio);

        if (!error) {
          await this.fetchProducts();
          return { ok: true };
        }
      } catch (err) {
        console.warn('Error cancelando venta en Supabase:', err);
      }
    }
    return { ok: false, error: 'No se pudo cancelar en Supabase' };
  },

  saveSalesHistory(history) {
    safeSetStorage('pos_sales_history', JSON.stringify(history));
    return history;
  },

  /**
   * Suscripción en tiempo real a cambios de productos (compartido entre Caja 1 y Caja 2)
   */
  subscribeToProducts(onChange) {
    const client = this.getClient();
    if (!client || typeof client.channel !== 'function') return null;
    try {
      return client
        .channel('products-live-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
          if (typeof onChange === 'function') onChange();
        })
        .subscribe();
    } catch (e) {
      return null;
    }
  },

  /**
   * Suscripción en tiempo real a cambios de turnos y cortes de caja
   */
  subscribeToShifts(onChange) {
    const client = this.getClient();
    if (!client || typeof client.channel !== 'function') return null;
    try {
      return client
        .channel('cash-cuts-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_cuts' }, () => {
          if (typeof onChange === 'function') onChange();
        })
        .subscribe();
    } catch (e) {
      return null;
    }
  },

  // Recepción de mercancía
  async getPackages() {
    const client = this.getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('product_packages')
          .select('barcode, product_id, units, description')
          .order('created_at', { ascending: false });
        if (!error && Array.isArray(data)) return data;
      } catch (e) {}
    }
    return [];
  },

  async savePackage(pkg) {
    const client = this.getClient();
    if (client) {
      try {
        const { error } = await client.from('product_packages').upsert({
          barcode: String(pkg.barcode).trim(),
          product_id: Number(pkg.product_id),
          units: parseInt(pkg.units, 10) || 1,
          description: pkg.description || null
        }, { onConflict: 'barcode' });
        if (error) return { ok: false, error: error.message };
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }
    return { ok: false, error: 'Sin conexión' };
  },

  async isInvoiceReceived(uuid) {
    if (!uuid) return false;
    const client = this.getClient();
    if (client) {
      try {
        const { data } = await client.from('supplier_invoices').select('uuid').eq('uuid', uuid).maybeSingle();
        return !!data;
      } catch (e) {}
    }
    return false;
  },

  async markInvoiceReceived(invoice) {
    if (!invoice.uuid) return;
    const client = this.getClient();
    if (client) {
      try {
        await client.from('supplier_invoices').insert([{
          uuid: invoice.uuid,
          supplier_name: invoice.supplierName,
          supplier_rfc: invoice.supplierRfc,
          folio: invoice.folio,
          total: invoice.total,
          pieces_added: invoice.piecesAdded
        }]);
      } catch (e) {}
    }
  }
};

window.PosDataService = PosDataService;
window.INITIAL_INVENTORY = INITIAL_INVENTORY;
window.INITIAL_SALES_HISTORY = INITIAL_SALES_HISTORY;
window.initSupabaseClient = initSupabaseClient;
