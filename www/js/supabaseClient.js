/**
 * SUPABASE CLIENT & DATA LAYER
 * Conexión nativa con Supabase (PostgreSQL) para NEXUS Retail POS
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

// Catálogo base de referencia (utilizado como fallback mientras carga la red)
const INITIAL_INVENTORY = [
  { id: 1, barcode: '7501820511234', sku: '7501820511234', name: 'Leche Lala Entera 1L', category: 'Lácteos y Cremería', cost: 22.50, price: 29.50, stock: 34 },
  { id: 2, barcode: '750185538472', sku: '750185538472', name: 'Coca-Cola Original 600ml', category: 'Bebidas y Refrescos', cost: 14.00, price: 19.00, stock: 42 },
  { id: 3, barcode: '750103912089', sku: '750103912089', name: 'Aceite Nutrioli 850ml', category: 'Abarrotes y Granos', cost: 36.00, price: 45.00, stock: 4 },
  { id: 4, barcode: '750188881235', sku: '750188881235', name: 'Huevo Blanco San Juan 1kg', category: 'Abarrotes y Granos', cost: 42.00, price: 52.00, stock: 15 },
  { id: 5, barcode: '750954123456', sku: '750954123456', name: 'Pan Bimbo Blanco 680g', category: 'Panadería', cost: 28.00, price: 38.00, stock: 0 },
  { id: 6, barcode: '750321654789', sku: '750321654789', name: 'Manzana Roja 1kg', category: 'Frutas y Verduras', cost: 25.00, price: 35.00, stock: 50 },
  { id: 7, barcode: '750741852963', sku: '750741852963', name: 'Arroz Morelos 1kg', category: 'Abarrotes y Granos', cost: 18.00, price: 26.00, stock: 3 },
  { id: 8, barcode: '750369258147', sku: '750369258147', name: 'Frijol Pinto 1kg', category: 'Abarrotes y Granos', cost: 22.00, price: 32.00, stock: 27 },
  { id: 9, barcode: '750147258369', sku: '750147258369', name: 'Sabritas Original 45g', category: 'Botanas', cost: 10.00, price: 15.00, stock: 60 },
  { id: 10, barcode: '750258369147', sku: '750258369147', name: 'Jabón Zote 200g', category: 'Limpieza e Higiene', cost: 8.00, price: 12.00, stock: 5 },
  { id: 11, barcode: '750369147258', sku: '750369147258', name: 'Papel Higiénico Suavel 4 rollos', category: 'Limpieza e Higiene', cost: 20.00, price: 32.00, stock: 18 },
  { id: 12, barcode: '750456789321', sku: '750456789321', name: 'Agua Ciel 1.5L', category: 'Bebidas y Refrescos', cost: 12.00, price: 16.00, stock: 33 }
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
      // Soporta window.supabase.createClient de la librería UMD
      const createFn = (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function')
        ? window.supabase.createClient
        : (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function' ? supabase.createClient : null);

      if (createFn) {
        supabaseClientInstance = createFn(url, key);
        isSupabaseConnected = true;
        console.log('Supabase conectado con éxito a:', url);
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
    statusText.textContent = 'BD Local (Activa) • Respaldo Diario';
  }
  if (statusDot) {
    statusDot.style.backgroundColor = '#10b981';
  }
}

// Intentar inicialización inmediata
initSupabaseClient();

const PosDataService = {
  getClient() {
    if (!supabaseClientInstance) initSupabaseClient();
    return supabaseClientInstance;
  },

  /**
   * Consulta directa al Master Local (/api/pos/products)
   * Sin race conditions: la base de datos local es la única dueña de los datos.
   */
  async fetchProducts() {
    try {
      const res = await fetch('/api/pos/products');
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && Array.isArray(data.products) && data.products.length > 0) {
          const formatted = data.products.map(p => ({
            id: p.id,
            barcode: p.barcode,
            sku: p.sku || p.barcode,
            name: p.name,
            displayName: p.displayName || p.name,
            category: p.category,
            cost: parseFloat(p.cost || 0),
            price: parseFloat(p.price || 0),
            stock: parseInt(p.stock, 10) || 0,
            iconType: p.iconType || 'bread',
            promoRule: p.promoRule || null
          }));

          safeSetStorage('pos_inventory_products', JSON.stringify(formatted));
          updateSyncIndicator(true);
          return formatted;
        }
      }
    } catch (err) {
      // Si la llamada de red local falla, recurre al almacenamiento local del navegador
    }

    return this.getInventoryProducts();
  },

  /**
   * Obtiene inventario de forma inmediata (con fallback local/inicial)
   */
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
   * Consulta las ventas del día desde la base de datos local
   */
  async fetchSales() {
    try {
      const res = await fetch('/api/pos/sales');
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && Array.isArray(data.sales)) {
          safeSetStorage('pos_sales_history', JSON.stringify(data.sales));
          return data.sales;
        }
      }
    } catch (err) {}

    return this.getSalesHistory();
  },

  getSalesHistory() {
    const stored = safeGetStorage('pos_sales_history');
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Filtrar exclusivamente ventas realizadas el día de hoy
          const todaySales = parsed.filter(s => {
            if (!s.created_at) return false;
            const dt = new Date(s.created_at);
            return (!isNaN(dt.getTime()) && dt >= todayMidnight) || s.created_at.startsWith(todayStr);
          });
          return todaySales;
        }
      } catch (e) {}
    }
    return [];
  },

  /**
   * Guarda o actualiza un producto en la base de datos local
   */
  async saveProduct(product) {
    try {
      const res = await fetch('/api/producto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo_barras: product.barcode,
          nombre: product.name,
          categoria: product.category,
          costo: product.cost,
          precio: product.price,
          stock: product.stock,
          origen: 'pos'
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.producto) {
          product.id = data.producto.id;
        }
      }
    } catch (e) {}
    return product;
  },

  /**
   * Elimina un producto
   */
  async deleteProduct(productId) {
    const products = this.getInventoryProducts().filter(p => p.id !== productId);
    this.saveInventoryProducts(products);
  },

  /**
   * Guarda lote de productos en local
   */
  async saveInventoryProducts(products) {
    safeSetStorage('pos_inventory_products', JSON.stringify(products));
    return products;
  },

  /**
   * Entrada de mercancía por compra (actualiza stock y costo, y registra en Kardex)
   */
  async registerStockEntry(productId, quantity, unitCost) {
    const client = this.getClient();
    if (client && isSupabaseConnected) {
      try {
        const { data: prod } = await client
          .from('products')
          .select('stock, cost')
          .eq('id', productId)
          .single();

        if (prod) {
          const newStock = (prod.stock || 0) + quantity;
          const newCost = (!isNaN(unitCost) && unitCost > 0) ? unitCost : prod.cost;

          await client
            .from('products')
            .update({ stock: newStock, cost: newCost })
            .eq('id', productId);

          await client.from('inventory_movements').insert([{
            product_id: productId,
            movement_type: 'purchase_entry',
            quantity: quantity,
            previous_stock: prod.stock,
            new_stock: newStock,
            unit_cost: newCost,
            notes: `Entrada por compra (+${quantity} uds)`,
            created_by: 'Administrador'
          }]);

          console.log(`Entrada de inventario registrada en Supabase para producto ${productId}`);
          await this.fetchProducts();
        }
      } catch (e) {
        console.warn('Error registrando entrada en Supabase:', e);
      }
    }
  },

  /**
   * Merma de producto (descuenta stock y registra en Kardex)
   */
  async registerShrinkage(productId, quantity, reasonType, notesText = '') {
    const products = this.getInventoryProducts();
    const prod = products.find(p => Number(p.id) === Number(productId));
    const unitCost = prod ? parseFloat(prod.cost || 0) : 0;
    const productName = prod ? prod.name : 'Producto #' + productId;
    const barcode = prod ? prod.barcode : '';
    const loss = Math.round((unitCost * quantity) * 100) / 100;

    // Registrar en historial local de mermas
    const history = this.getShrinkageHistory();
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} · ${pad(now.getHours())}:${pad(now.getMinutes())} hrs`;

    history.unshift({
      id: Date.now(),
      productId: Number(productId),
      productName,
      barcode,
      quantity,
      reasonType,
      unitCost,
      totalLoss: loss,
      notes: notesText || `Merma aplicada: ${reasonType}`,
      date: dateStr,
      createdBy: 'Administrador'
    });
    this.saveShrinkageHistory(history);

    const client = this.getClient();
    if (client && isSupabaseConnected) {
      try {
        const { data: dbProd } = await client
          .from('products')
          .select('stock, cost')
          .eq('id', productId)
          .single();

        if (dbProd) {
          const newStock = Math.max(0, (dbProd.stock || 0) - quantity);
          let movType = 'shrinkage_damaged';
          if (reasonType && reasonType.includes('caduc')) movType = 'shrinkage_expired';
          if (reasonType && reasonType.includes('robo')) movType = 'shrinkage_theft';

          await client
            .from('products')
            .update({ stock: newStock })
            .eq('id', productId);

          await client.from('inventory_movements').insert([{
            product_id: productId,
            movement_type: movType,
            quantity: -quantity,
            previous_stock: dbProd.stock,
            new_stock: newStock,
            unit_cost: dbProd.cost,
            notes: notesText || `Merma aplicada: ${reasonType}`,
            created_by: 'Administrador'
          }]);

          console.log(`Merma registrada en Supabase para producto ${productId}`);
          await this.fetchProducts();
        }
      } catch (e) {
        console.warn('Error registrando merma en Supabase:', e);
      }
    }
  },

  getShrinkageHistory() {
    const stored = safeGetStorage('pos_shrinkage_history');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    const defaultMermas = [
      {
        id: 1,
        productId: 1,
        productName: 'Leche Lala Entera 1L',
        barcode: '7501820511234',
        quantity: 3,
        reasonType: 'Producto Caducado',
        unitCost: 22.50,
        totalLoss: 67.50,
        notes: 'Lote vencido reportado en revisión matutina',
        date: '02/11/2026 · 08:45 hrs',
        createdBy: 'Administrador'
      },
      {
        id: 2,
        productId: 4,
        productName: 'Huevo Blanco San Juan 1kg',
        barcode: '750188881235',
        quantity: 4,
        reasonType: 'Producto Dañado / Roto',
        unitCost: 42.00,
        totalLoss: 168.00,
        notes: 'Caja golpeada durante maniobra de estiba',
        date: '01/11/2026 · 17:20 hrs',
        createdBy: 'Administrador'
      },
      {
        id: 3,
        productId: 5,
        productName: 'Pan Bimbo Blanco 680g',
        barcode: '750954123456',
        quantity: 2,
        reasonType: 'Producto Caducado',
        unitCost: 28.00,
        totalLoss: 56.00,
        notes: 'Fecha de consumo preferente alcanzada',
        date: '31/10/2026 · 19:10 hrs',
        createdBy: 'Administrador'
      },
      {
        id: 4,
        productId: 9,
        productName: 'Sabritas Original 45g',
        barcode: '750147258369',
        quantity: 5,
        reasonType: 'Robo / Faltante',
        unitCost: 10.00,
        totalLoss: 50.00,
        notes: 'Diferencia detectada en conteo físico de pasillo',
        date: '30/10/2026 · 14:15 hrs',
        createdBy: 'Administrador'
      },
      {
        id: 5,
        productId: 2,
        productName: 'Coca-Cola Original 600ml',
        barcode: '750185538472',
        quantity: 2,
        reasonType: 'Producto Dañado / Roto',
        unitCost: 14.00,
        totalLoss: 28.00,
        notes: 'Envase perforado con pérdida de gas',
        date: '29/10/2026 · 11:30 hrs',
        createdBy: 'Administrador'
      }
    ];
    safeSetStorage('pos_shrinkage_history', JSON.stringify(defaultMermas));
    return defaultMermas;
  },

  saveShrinkageHistory(list) {
    safeSetStorage('pos_shrinkage_history', JSON.stringify(list));
    return list;
  },

  /**
   * Busca producto por código de barras, SKU o coincidencia de nombre
   */
  async findProductByBarcode(code) {
    if (!code) return null;
    const cleanCode = code.trim().toLowerCase();

    const client = this.getClient();
    if (client && isSupabaseConnected) {
      try {
        let { data, error } = await client
          .from('products')
          .select('*')
          .or(`barcode.eq.${cleanCode},sku.eq.${cleanCode}`)
          .maybeSingle();

        if (!data) {
          const { data: nameMatch } = await client
            .from('products')
            .select('*')
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
        iconType: 'bread',
        promoRule: null
      };
    }

    // Búsqueda en catálogo nacional mexicano si no está en inventario local
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
   * Búsqueda predictiva de productos en tiempo real (autocompletado al teclear)
   */
  async searchProducts(term) {
    if (!term || !term.trim()) return [];
    const cleanTerm = term.trim().toLowerCase();

    const matches = [];
    const localList = this.getInventoryProducts() || [];

    // Búsqueda en Supabase si está disponible
    const client = this.getClient();
    if (client && isSupabaseConnected) {
      try {
        const { data, error } = await client
          .from('products')
          .select('*')
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
      } catch (e) {
        console.warn('Error en búsqueda predictiva Supabase:', e);
      }
    }

    // Búsqueda en inventario local / fallback
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
            displayName: item.display_name || item.name,
            price: parseFloat(item.price || 0),
            unitPrice: parseFloat(item.price || 0),
            category: item.category || 'General',
            stock: parseInt(item.stock || 0, 10),
            iconType: item.icon_type || 'bread',
            promoRule: item.promo_rule || null
          });
        }
      }
    });

    // Búsqueda en catálogo nacional mexicano
    if (typeof window !== 'undefined' && Array.isArray(window.MEXICO_BARCODES)) {
      window.MEXICO_BARCODES.forEach(item => {
        const bcode = String(item.barcode || '').toLowerCase();
        const name = String(item.name || '').toLowerCase();
        const cat = String(item.category || '').toLowerCase();

        if (bcode.includes(cleanTerm) || name.includes(cleanTerm) || cat.includes(cleanTerm)) {
          if (!matches.some(m => m.barcode === item.barcode)) {
            matches.push({
              id: 'mb_' + item.barcode,
              barcode: item.barcode,
              sku: item.barcode,
              name: item.name,
              displayName: item.name,
              price: parseFloat(item.price || 0),
              unitPrice: parseFloat(item.price || 0),
              category: item.category || 'General',
              stock: 50,
              iconType: 'bread',
              promoRule: null
            });
          }
        }
      });
    }

    // Ordenar por relevancia: los que empiezan con el término primero
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
   * Obtiene servicios rápidos
   */
  async getQuickServices() {
    const client = this.getClient();
    if (client && isSupabaseConnected) {
      try {
        const { data, error } = await client
          .from('quick_services')
          .select('*')
          .eq('is_active', true);
        if (!error && data && data.length > 0) return data;
      } catch (err) {}
    }
    return [
      { id: 'recargas', name: 'Recargas', icon: 'phone', subtitle: 'Tiempo aire' },
      { id: 'pago_1', name: 'Pago de x', icon: 'time', subtitle: 'Servicio' },
      { id: 'pago_2', name: 'Pago con comisión $5.00', icon: 'bill', subtitle: 'Comisión $5.00' },
      { id: 'pago_3', name: 'Pago de x', icon: 'water', subtitle: 'Servicio general' }
    ];
  },

  /**
   * Registra una venta completa en la Base de Datos Local (Master)
   * con actualización atómica de stock y registro en Kardex
   */
  async registerSale(salePayload, items = []) {
    try {
      const res = await fetch('/api/pos/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...salePayload,
          items: items.map(it => ({
            id: it.id,
            barcode: it.barcode || it.sku,
            sku: it.sku || it.barcode,
            name: it.name,
            unitPrice: it.unitPrice || it.price || 0,
            quantity: it.quantity || 1,
            discount: it.discount || 0,
            subtotal: it.subtotal || ((it.unitPrice || it.price || 0) * (it.quantity || 1)),
            promoRule: it.promoRule || null
          }))
        })
      });

      if (res.ok) {
        const result = await res.json();
        // Si el backend devolvió el nuevo stock de los productos afectados, actualizar caché inmediatamente
        if (result && result.updatedProducts && Array.isArray(result.updatedProducts)) {
          const prods = this.getInventoryProducts();
          result.updatedProducts.forEach(up => {
            const p = prods.find(x => x.id === up.id || x.barcode === up.barcode);
            if (p) p.stock = up.newStock;
          });
          safeSetStorage('pos_inventory_products', JSON.stringify(prods));
        }
        return { success: true, localMaster: true, result };
      }
    } catch (err) {
      console.warn('Venta procesada localmente:', err);
    }
    return { success: true, localOnly: true };
  },

  /**
   * Cancela una venta registrada en la base de datos local y restituye existencias
   */
  async cancelSale(ticketFolio, adminName = 'Administrador') {
    try {
      await fetch('/api/pos/cancel-sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folio: ticketFolio,
          reason: 'Cancelación autorizada en punto de venta'
        })
      });
    } catch (err) {
      console.warn('Cancelación local:', err);
    }
  },

  saveSalesHistory(history) {
    safeSetStorage('pos_sales_history', JSON.stringify(history));
    return history;
  },

  // ===========================================================================
  // RECEPCIÓN DE MERCANCÍA (escáner, cajas / códigos padre y facturas CFDI)
  // ===========================================================================

  /** Cajas guardadas en este equipo (respaldo cuando no hay internet) */
  getLocalPackages() {
    const stored = safeGetStorage('pos_product_packages');
    if (stored) {
      try { return JSON.parse(stored); } catch (e) {}
    }
    return [
      { barcode: '17501820511231', product_id: 1, units: 12, description: 'Caja Leche Lala Entera 1L (12 pzas)' },
      { barcode: '17501855384729', product_id: 2, units: 24, description: 'Caja Coca-Cola 600ml (24 pzas)' }
    ];
  },

  saveLocalPackages(list) {
    safeSetStorage('pos_product_packages', JSON.stringify(list));
  },

  /** Lista de cajas (códigos padre) */
  async getPackages() {
    const client = this.getClient();
    if (client && isSupabaseConnected) {
      try {
        const { data, error } = await client
          .from('product_packages')
          .select('barcode, product_id, units, description')
          .order('created_at', { ascending: false });
        if (!error && Array.isArray(data)) {
          this.saveLocalPackages(data);
          return data;
        }
      } catch (e) {}
    }
    return this.getLocalPackages();
  },

  /** Guarda (o actualiza) una caja: código de la caja -> producto x piezas */
  async savePackage(pkg) {
    const row = {
      barcode: String(pkg.barcode).trim(),
      product_id: Number(pkg.product_id),
      units: parseInt(pkg.units, 10) || 1,
      description: pkg.description || null
    };

    const local = this.getLocalPackages().filter(p => p.barcode !== row.barcode);
    local.unshift(row);
    this.saveLocalPackages(local);

    const client = this.getClient();
    if (client && isSupabaseConnected) {
      try {
        const { error } = await client.from('product_packages').upsert(row, { onConflict: 'barcode' });
        if (error) return { ok: false, error: error.message };
      } catch (e) {}
    }
    return { ok: true };
  },

  async deletePackage(barcode) {
    this.saveLocalPackages(this.getLocalPackages().filter(p => p.barcode !== barcode));
    const client = this.getClient();
    if (client && isSupabaseConnected) {
      try {
        await client.from('product_packages').delete().eq('barcode', barcode);
      } catch (e) {}
    }
  },

  /**
   * Identifica un código escaneado SIN modificar nada.
   * Devuelve { product, units, isPackage } o null si no existe.
   */
  async lookupReceivingCode(code) {
    const clean = String(code || '').trim();
    if (!clean) return null;

    const client = this.getClient();
    if (client && isSupabaseConnected) {
      try {
        const { data: prod, error: prodError } = await client
          .from('products')
          .select('id, barcode, name, stock, cost')
          .or(`barcode.eq.${clean},sku.eq.${clean}`)
          .limit(1)
          .maybeSingle();
        if (prod) return { product: prod, units: 1, isPackage: false };

        const { data: pkg, error: pkgError } = await client
          .from('product_packages')
          .select('units, products(id, barcode, name, stock, cost)')
          .eq('barcode', clean)
          .maybeSingle();
        if (pkg && pkg.products) return { product: pkg.products, units: pkg.units, isPackage: true };
        if (!prodError && !pkgError) return null; // Consultó bien y no existe
      } catch (e) {}
    }

    // Respaldo local
    const products = this.getInventoryProducts();
    const prodLocal = products.find(p => p.barcode === clean || p.sku === clean);
    if (prodLocal) return { product: prodLocal, units: 1, isPackage: false };

    const pkgLocal = this.getLocalPackages().find(p => p.barcode === clean);
    if (pkgLocal) {
      const parent = products.find(p => Number(p.id) === Number(pkgLocal.product_id));
      if (parent) return { product: parent, units: pkgLocal.units, isPackage: true };
    }
    return null;
  },

  /**
   * Suma mercancía al stock. La lógica de cajas vive en el servidor
   * (función receive_stock en Supabase). Sin internet se hace en este equipo.
   */
  async receiveStock(code, quantity, unitCost = null, source = 'Recepción') {
    const qty = parseInt(quantity, 10) || 0;
    const client = this.getClient();

    if (client && isSupabaseConnected) {
      try {
        const { data, error } = await client.rpc('receive_stock', {
          p_code: String(code).trim(),
          p_quantity: qty,
          p_unit_cost: unitCost,
          p_source: source
        });

        if (!error && data) {
          if (data.ok) await this.fetchProducts();
          return data;
        }
        if (error && (error.code === 'PGRST202' || error.code === '42883')) {
          return { ok: false, error: 'Falta ejecutar supabase/recepcion_mercancia.sql en Supabase.' };
        }
        // Error de la base de datos (no de red): no guardar localmente para no desincronizar
        if (error && error.code) {
          return { ok: false, error: error.message };
        }
      } catch (e) {
        console.warn('Sin conexión, se guarda la entrada en este equipo:', e);
      }
    }

    return this.receiveStockLocal(code, qty, unitCost);
  },

  receiveStockLocal(code, qty, unitCost) {
    if (qty <= 0) return { ok: false, error: 'La cantidad debe ser mayor a 0' };

    const clean = String(code).trim();
    const products = this.getInventoryProducts();
    let units = 1;
    let isPackage = false;
    let product = products.find(p => p.barcode === clean || p.sku === clean);

    if (!product) {
      const pkg = this.getLocalPackages().find(p => p.barcode === clean);
      if (pkg) {
        product = products.find(p => Number(p.id) === Number(pkg.product_id));
        units = pkg.units;
        isPackage = true;
      }
    }

    if (!product) return { ok: false, error: 'Código no registrado: ' + clean };

    const added = qty * units;
    product.stock = (parseInt(product.stock, 10) || 0) + added;
    if (unitCost && unitCost > 0) product.cost = Math.round((unitCost / units) * 100) / 100;
    safeSetStorage('pos_inventory_products', JSON.stringify(products));

    return {
      ok: true,
      offline: true,
      product_id: product.id,
      product_name: product.name,
      is_package: isPackage,
      units_per_package: units,
      units_added: added,
      new_stock: product.stock,
      unit_cost: product.cost
    };
  },

  /** ¿Esta factura (UUID del timbre) ya se había cargado? */
  async isInvoiceReceived(uuid) {
    if (!uuid) return false;
    const local = JSON.parse(safeGetStorage('pos_received_invoices') || '[]');
    if (local.includes(uuid)) return true;

    const client = this.getClient();
    if (client && isSupabaseConnected) {
      try {
        const { data } = await client
          .from('supplier_invoices')
          .select('uuid')
          .eq('uuid', uuid)
          .maybeSingle();
        return !!data;
      } catch (e) {}
    }
    return false;
  },

  async markInvoiceReceived(invoice) {
    if (!invoice.uuid) return;
    const local = JSON.parse(safeGetStorage('pos_received_invoices') || '[]');
    local.push(invoice.uuid);
    safeSetStorage('pos_received_invoices', JSON.stringify(local));

    const client = this.getClient();
    if (client && isSupabaseConnected) {
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
  },

  /** Avisa cuando otro equipo (ej. el celular) cambia productos */
  subscribeToProducts(onChange) {
    const client = this.getClient();
    if (!client || !isSupabaseConnected || typeof client.channel !== 'function') return null;
    try {
      return client
        .channel('products-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => onChange())
        .subscribe();
    } catch (e) {
      return null;
    }
  },

  /**
   * Registra corte de caja en Supabase
   */
  async registerCashCut(cutData) {
    const client = this.getClient();
    if (client && isSupabaseConnected) {
      try {
        const { data, error } = await client
          .from('cash_cuts')
          .insert([cutData])
          .select();
        if (!error) console.log('Corte de caja registrado en Supabase:', data);
      } catch (err) {
        console.warn('Error guardando corte en Supabase:', err);
      }
    }
  }
};

window.PosDataService = PosDataService;
window.INITIAL_INVENTORY = INITIAL_INVENTORY;
window.INITIAL_SALES_HISTORY = INITIAL_SALES_HISTORY;
window.initSupabaseClient = initSupabaseClient;
