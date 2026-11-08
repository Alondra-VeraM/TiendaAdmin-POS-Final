/**
 * ==============================================================================
 * LOCAL DATABASE (MASTER SOURCE OF TRUTH FOR NEXUS RETAIL POS)
 * ==============================================================================
 * Motor de base de datos local de alta velocidad, transaccional y persistente.
 * Elimina race conditions: la base de datos local es la única dueña de los
 * datos y del stock. La nube (Supabase) actúa exclusivamente como respaldo diario.
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_DIR = __dirname;
const DB_FILE = path.join(DB_DIR, 'pos_local.sqlite');
const BACKUP_JSON_FILE = path.join(DB_DIR, 'pos_local_data.json');

// Catálogo base de inicialización si la base de datos es nueva
const DEFAULT_PRODUCTS = [
  { barcode: '7501820511234', sku: '7501820511234', name: 'Leche Lala Entera 1L', category: 'Lácteos y Cremería', cost: 22.50, price: 29.50, stock: 34 },
  { barcode: '750185538472', sku: '750185538472', name: 'Coca-Cola Original 600ml', category: 'Bebidas y Refrescos', cost: 14.00, price: 19.00, stock: 42 },
  { barcode: '750103912089', sku: '750103912089', name: 'Aceite Nutrioli 850ml', category: 'Abarrotes y Granos', cost: 36.00, price: 45.00, stock: 4 },
  { barcode: '750188881235', sku: '750188881235', name: 'Huevo Blanco San Juan 1kg', category: 'Abarrotes y Granos', cost: 42.00, price: 52.00, stock: 15 },
  { barcode: '750954123456', sku: '750954123456', name: 'Pan Bimbo Blanco 680g', category: 'Panadería', cost: 28.00, price: 38.00, stock: 0 },
  { barcode: '750321654789', sku: '750321654789', name: 'Manzana Roja 1kg', category: 'Frutas y Verduras', cost: 25.00, price: 35.00, stock: 50 },
  { barcode: '750741852963', sku: '750741852963', name: 'Arroz Morelos 1kg', category: 'Abarrotes y Granos', cost: 18.00, price: 26.00, stock: 3 },
  { barcode: '750369258147', sku: '750369258147', name: 'Frijol Pinto 1kg', category: 'Abarrotes y Granos', cost: 22.00, price: 32.00, stock: 27 },
  { barcode: '750147258369', sku: '750147258369', name: 'Sabritas Original 45g', category: 'Botanas', cost: 10.00, price: 15.00, stock: 60 },
  { barcode: '750258369147', sku: '750258369147', name: 'Jabón Zote 200g', category: 'Limpieza e Higiene', cost: 8.00, price: 12.00, stock: 5 },
  { barcode: '750369147258', sku: '750369147258', name: 'Papel Higiénico Suavel 4 rollos', category: 'Limpieza e Higiene', cost: 20.00, price: 32.00, stock: 18 },
  { barcode: '750456789321', sku: '750456789321', name: 'Agua Ciel 1.5L', category: 'Bebidas y Refrescos', cost: 12.00, price: 16.00, stock: 33 }
];

let db = null;
let isBackingUp = false;

function initLocalDatabase() {
  if (db) return db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  db = new DatabaseSync(DB_FILE);

  // Rendimiento óptimo y concurrencia segura
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // 1. Tabla de Productos
  db.exec(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_barras TEXT NOT NULL UNIQUE,
      sku TEXT,
      nombre TEXT NOT NULL,
      marca TEXT,
      categoria TEXT DEFAULT 'Abarrotes',
      precio_costo REAL NOT NULL DEFAULT 0.00,
      precio_venta REAL NOT NULL DEFAULT 0.00,
      stock INTEGER NOT NULL DEFAULT 0,
      origen_datos TEXT DEFAULT 'manual',
      fecha_creacion TEXT DEFAULT (datetime('now', 'localtime')),
      fecha_actualizacion TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 2. Tabla de Ventas (Tickets)
  db.exec(`
    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folio TEXT NOT NULL UNIQUE,
      terminal_code TEXT DEFAULT 'C1',
      terminal_name TEXT DEFAULT 'Caja 1',
      cashier_name TEXT DEFAULT 'Elena R.',
      total_items INTEGER DEFAULT 1,
      total_pieces INTEGER DEFAULT 1,
      subtotal REAL DEFAULT 0.00,
      discount REAL DEFAULT 0.00,
      total_net REAL DEFAULT 0.00,
      payment_method TEXT DEFAULT 'cash',
      status TEXT DEFAULT 'completed',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      synced_to_cloud INTEGER DEFAULT 0
    );
  `);

  // 3. Tabla de Partidas de Ventas
  db.exec(`
    CREATE TABLE IF NOT EXISTS venta_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER,
      folio TEXT NOT NULL,
      product_id INTEGER,
      barcode TEXT,
      product_name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      discount REAL DEFAULT 0.00,
      subtotal REAL NOT NULL,
      promo_applied TEXT
    );
  `);

  // 4. Tabla de Kardex / Movimientos de Inventario
  db.exec(`
    CREATE TABLE IF NOT EXISTS movimientos_inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      tipo_movimiento TEXT NOT NULL,
      cantidad INTEGER NOT NULL,
      stock_anterior INTEGER NOT NULL,
      stock_nuevo INTEGER NOT NULL,
      precio_costo_unitario REAL,
      notas TEXT,
      fecha TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 5. Tabla de Cortes de Caja
  db.exec(`
    CREATE TABLE IF NOT EXISTS cortes_caja (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      terminal_code TEXT DEFAULT 'C1',
      cashier_name TEXT DEFAULT 'Elena R.',
      initial_cash REAL DEFAULT 0.00,
      sales_cash REAL DEFAULT 0.00,
      sales_card REAL DEFAULT 0.00,
      sales_transfer REAL DEFAULT 0.00,
      total_sales REAL DEFAULT 0.00,
      counted_cash REAL DEFAULT 0.00,
      difference REAL DEFAULT 0.00,
      status TEXT DEFAULT 'closed',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      synced_to_cloud INTEGER DEFAULT 0
    );
  `);

  // 6. Tabla de Metadatos y Control del Sistema
  db.exec(`
    CREATE TABLE IF NOT EXISTS config_sistema (
      clave TEXT PRIMARY KEY,
      valor TEXT,
      actualizado_el TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Inicializar productos si la tabla está vacía
  const countStmt = db.prepare('SELECT COUNT(*) AS total FROM productos');
  const countRow = countStmt.get();
  if (!countRow || countRow.total === 0) {
    const insertStmt = db.prepare(`
      INSERT INTO productos (codigo_barras, sku, nombre, categoria, precio_costo, precio_venta, stock, origen_datos)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'inicial')
    `);

    db.exec('BEGIN TRANSACTION');
    for (const p of DEFAULT_PRODUCTS) {
      insertStmt.run(p.barcode, p.sku || p.barcode, p.name, p.category, p.cost, p.price, p.stock);
    }
    db.exec('COMMIT');
    console.log(`[DB LOCAL] Inicializados ${DEFAULT_PRODUCTS.length} productos base.`);
  }

  // Guardar snapshot de respaldo JSON
  exportBackupJson();

  return db;
}

// Exporta snapshot JSON seguro
function exportBackupJson() {
  try {
    if (!db) return;
    const prods = db.prepare('SELECT * FROM productos').all();
    const sales = db.prepare('SELECT * FROM ventas ORDER BY id DESC LIMIT 500').all();
    const data = {
      exported_at: new Date().toISOString(),
      products_count: prods.length,
      sales_count: sales.length,
      products: prods
    };
    fs.writeFileSync(BACKUP_JSON_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('[DB LOCAL] Error generando snapshot JSON:', err.message);
  }
}

// ==============================================================================
// OPERACIONES DE PRODUCTOS & INVENTARIO (LOCAL MASTER)
// ==============================================================================

function getProducts() {
  const d = initLocalDatabase();
  const rows = d.prepare('SELECT * FROM productos ORDER BY id ASC').all();
  return rows.map(r => ({
    id: r.id,
    barcode: r.codigo_barras,
    sku: r.sku || r.codigo_barras,
    name: r.nombre,
    displayName: r.nombre,
    brand: r.marca || '',
    category: r.categoria || 'Abarrotes',
    cost: parseFloat(r.precio_costo || 0),
    price: parseFloat(r.precio_venta || 0),
    stock: parseInt(r.stock, 10) || 0,
    iconType: 'bread',
    origen: r.origen_datos || 'local',
    updatedAt: r.fecha_actualizacion
  }));
}

function findProductByBarcode(code) {
  if (!code) return null;
  const clean = String(code).trim();
  const cleanNoZeros = clean.replace(/^0+/, '');
  const d = initLocalDatabase();

  const stmt = d.prepare(`
    SELECT * FROM productos 
    WHERE codigo_barras = ? OR sku = ? OR codigo_barras = ? OR sku = ?
    LIMIT 1
  `);
  const row = stmt.get(clean, clean, cleanNoZeros, cleanNoZeros);
  if (!row) return null;

  return {
    id: row.id,
    barcode: row.codigo_barras,
    sku: row.sku || row.codigo_barras,
    name: row.nombre,
    displayName: row.nombre,
    brand: row.marca || '',
    category: row.categoria || 'Abarrotes',
    cost: parseFloat(row.precio_costo || 0),
    price: parseFloat(row.precio_venta || 0),
    stock: parseInt(row.stock, 10) || 0,
    iconType: 'bread',
    origen: row.origen_datos || 'local'
  };
}

function saveProduct(product) {
  const d = initLocalDatabase();
  const barcode = String(product.barcode || product.codigo_barras || '').trim();
  const name = String(product.name || product.nombre || '').trim();
  const brand = String(product.brand || product.marca || '').trim();
  const category = String(product.category || product.categoria || 'Abarrotes').trim();
  const cost = Math.max(0, parseFloat(product.cost || product.precio_costo || 0));
  const price = Math.max(0, parseFloat(product.price || product.precio_venta || 0));
  const stock = parseInt(product.stock, 10) || 0;
  const origin = product.origen || product.origen_datos || 'manual';

  if (!barcode || !name) {
    throw new Error('Código de barras y nombre son requeridos');
  }

  const existing = d.prepare('SELECT id, stock FROM productos WHERE codigo_barras = ?').get(barcode);

  let resultId = null;
  if (existing) {
    d.prepare(`
      UPDATE productos 
      SET nombre = ?, marca = ?, categoria = ?, precio_costo = ?, precio_venta = ?, stock = ?, 
          origen_datos = ?, fecha_actualizacion = (datetime('now', 'localtime'))
      WHERE id = ?
    `).run(name, brand, category, cost, price, stock, origin, existing.id);
    resultId = existing.id;
  } else {
    const info = d.prepare(`
      INSERT INTO productos (codigo_barras, sku, nombre, marca, categoria, precio_costo, precio_venta, stock, origen_datos)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(barcode, barcode, name, brand, category, cost, price, stock, origin);
    resultId = Number(info.lastInsertRowid);
  }

  exportBackupJson();

  return {
    id: resultId,
    barcode,
    sku: barcode,
    name,
    displayName: name,
    brand,
    category,
    cost,
    price,
    stock,
    iconType: 'bread'
  };
}

// Sumar stock de forma segura registrando movimiento
function addStock(barcode, quantity, unitCost = null, notes = 'Entrada') {
  const d = initLocalDatabase();
  const clean = String(barcode).trim();
  const qty = parseInt(quantity, 10) || 0;
  if (qty <= 0) throw new Error('Cantidad debe ser mayor a 0');

  const prod = d.prepare('SELECT * FROM productos WHERE codigo_barras = ? OR sku = ?').get(clean, clean);
  if (!prod) throw new Error(`Producto no encontrado con código ${clean}`);

  const stockAnterior = prod.stock;
  const stockNuevo = stockAnterior + qty;
  const finalCost = (unitCost != null && unitCost > 0) ? unitCost : prod.precio_costo;

  d.exec('BEGIN TRANSACTION');
  try {
    d.prepare(`
      UPDATE productos 
      SET stock = ?, precio_costo = ?, fecha_actualizacion = (datetime('now', 'localtime'))
      WHERE id = ?
    `).run(stockNuevo, finalCost, prod.id);

    d.prepare(`
      INSERT INTO movimientos_inventario (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, precio_costo_unitario, notas)
      VALUES (?, 'entrada_recepcion', ?, ?, ?, ?, ?)
    `).run(prod.id, qty, stockAnterior, stockNuevo, finalCost, notes);

    d.exec('COMMIT');
  } catch (err) {
    d.exec('ROLLBACK');
    throw err;
  }

  exportBackupJson();

  return {
    id: prod.id,
    barcode: prod.codigo_barras,
    name: prod.nombre,
    previousStock: stockAnterior,
    newStock: stockNuevo,
    quantityAdded: qty
  };
}

// ==============================================================================
// REGISTRO DE VENTA ATÓMICO CON DESCUENTO INMEDIATO DE STOCK (SIN RACE CONDITIONS)
// ==============================================================================

function processSale(salePayload, items = []) {
  const d = initLocalDatabase();

  const folio = String(salePayload.folio || ('#TK-' + Date.now())).trim();
  const terminalCode = salePayload.terminal_code || 'C1';
  const terminalName = salePayload.terminal_name || 'Caja 1';
  const cashierName = salePayload.cashier_name || 'Elena R.';
  const totalItems = parseInt(salePayload.total_items, 10) || items.length || 1;
  const totalPieces = parseInt(salePayload.total_pieces, 10) || items.reduce((sum, it) => sum + (it.quantity || 1), 0);
  const subtotal = parseFloat(salePayload.subtotal || 0);
  const discount = parseFloat(salePayload.discount || 0);
  const totalNet = parseFloat(salePayload.total_net || 0);
  const paymentMethod = salePayload.payment_method || 'cash';

  const updatedProducts = [];

  // Transacción atómica: se registra la venta y se descuenta el stock en un solo paso
  d.exec('BEGIN TRANSACTION');
  try {
    // 1. Insertar venta
    const saleInfo = d.prepare(`
      INSERT INTO ventas (folio, terminal_code, terminal_name, cashier_name, total_items, total_pieces, subtotal, discount, total_net, payment_method, status, synced_to_cloud)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', 0)
    `).run(folio, terminalCode, terminalName, cashierName, totalItems, totalPieces, subtotal, discount, totalNet, paymentMethod);

    const saleId = Number(saleInfo.lastInsertRowid);

    // 2. Procesar partidas y descontar stock
    const insertItemStmt = d.prepare(`
      INSERT INTO venta_items (venta_id, folio, product_id, barcode, product_name, unit_price, quantity, discount, subtotal, promo_applied)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStockStmt = d.prepare(`
      UPDATE productos 
      SET stock = ?, fecha_actualizacion = (datetime('now', 'localtime'))
      WHERE id = ?
    `);

    const insertMovStmt = d.prepare(`
      INSERT INTO movimientos_inventario (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, precio_costo_unitario, notas)
      VALUES (?, 'venta', ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      const qtySold = Math.max(1, parseInt(item.quantity, 10) || 1);
      const bcode = String(item.barcode || item.sku || '').trim();
      const uPrice = parseFloat(item.unitPrice || item.price || 0);
      const iSubtotal = parseFloat(item.subtotal || (uPrice * qtySold));
      const promo = item.promoRule ? (item.promoRule.badge_text || 'Promoción') : null;

      // Buscar producto local para descontar stock
      let prod = null;
      if (item.id && Number(item.id) > 0) {
        prod = d.prepare('SELECT * FROM productos WHERE id = ?').get(Number(item.id));
      }
      if (!prod && bcode) {
        prod = d.prepare('SELECT * FROM productos WHERE codigo_barras = ? OR sku = ?').get(bcode, bcode);
      }

      let prodId = null;
      let stockAnterior = 0;
      let stockNuevo = 0;

      if (prod) {
        prodId = prod.id;
        stockAnterior = prod.stock;
        stockNuevo = Math.max(0, stockAnterior - qtySold);

        // Descontar stock inmediatamente
        updateStockStmt.run(stockNuevo, prodId);

        // Registrar en Kardex
        insertMovStmt.run(prodId, -qtySold, stockAnterior, stockNuevo, prod.precio_costo, `Venta Folio ${folio}`);

        updatedProducts.push({
          id: prodId,
          barcode: prod.codigo_barras,
          name: prod.nombre,
          previousStock: stockAnterior,
          newStock: stockNuevo
        });
      }

      // Insertar detalle de venta
      insertItemStmt.run(saleId, folio, prodId, bcode, item.name || 'Producto', uPrice, qtySold, parseFloat(item.discount || 0), iSubtotal, promo);
    }

    d.exec('COMMIT');
  } catch (err) {
    d.exec('ROLLBACK');
    console.error('[DB LOCAL] Error atómico al procesar venta:', err);
    throw err;
  }

  exportBackupJson();

  console.log(`[VENTA LOCAL] Folio ${folio} registrado con éxito. Total: $${totalNet.toFixed(2)}. ${updatedProducts.length} productos actualizados en stock.`);

  return {
    ok: true,
    folio,
    totalNet,
    updatedProducts
  };
}

// Cancelar venta y devolver stock
function cancelSale(folio, reason = 'Cancelación autorizada') {
  const d = initLocalDatabase();
  const cleanFolio = String(folio).trim();

  const sale = d.prepare('SELECT * FROM ventas WHERE folio = ?').get(cleanFolio);
  if (!sale) throw new Error(`Venta ${cleanFolio} no encontrada`);
  if (sale.status === 'cancelled') throw new Error(`La venta ${cleanFolio} ya fue cancelada`);

  const saleItems = d.prepare('SELECT * FROM venta_items WHERE folio = ?').all(cleanFolio);

  d.exec('BEGIN TRANSACTION');
  try {
    // 1. Marcar venta cancelada
    d.prepare(`UPDATE ventas SET status = 'cancelled', synced_to_cloud = 0 WHERE id = ?`).run(sale.id);

    // 2. Restituir existencias
    for (const it of saleItems) {
      if (it.product_id) {
        const prod = d.prepare('SELECT * FROM productos WHERE id = ?').get(it.product_id);
        if (prod) {
          const stockNuevo = prod.stock + it.quantity;
          d.prepare(`UPDATE productos SET stock = ?, fecha_actualizacion = (datetime('now', 'localtime')) WHERE id = ?`)
            .run(stockNuevo, prod.id);

          d.prepare(`
            INSERT INTO movimientos_inventario (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, precio_costo_unitario, notas)
            VALUES (?, 'cancelacion_venta', ?, ?, ?, ?, ?)
          `).run(prod.id, it.quantity, prod.stock, stockNuevo, prod.precio_costo, `Cancelación de Ticket ${cleanFolio}`);
        }
      }
    }

    d.exec('COMMIT');
  } catch (err) {
    d.exec('ROLLBACK');
    throw err;
  }

  exportBackupJson();
  return { ok: true, folio: cleanFolio };
}

// Obtener ventas del día de hoy
function getTodaySales() {
  const d = initLocalDatabase();
  const rows = d.prepare(`
    SELECT * FROM ventas 
    WHERE date(created_at) = date('now', 'localtime')
    ORDER BY id DESC
  `).all();

  return rows.map(s => {
    const items = d.prepare('SELECT * FROM venta_items WHERE folio = ?').all(s.folio);
    const dt = new Date(s.created_at);
    const timeStr = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')} hrs`;

    return {
      id: s.id,
      folio: s.folio,
      date: timeStr,
      created_at: s.created_at,
      timeAgo: 'Hoy',
      cajaCode: s.terminal_code,
      cajaName: s.terminal_name,
      cashier: s.cashier_name,
      itemsCount: s.total_pieces,
      itemsSummary: `${s.total_pieces} producto${s.total_pieces > 1 ? 's' : ''}`,
      itemsDetail: `Venta registrada Folio ${s.folio}`,
      items: items.map(it => ({
        name: it.product_name,
        quantity: it.quantity,
        unitPrice: it.unit_price,
        total: it.subtotal
      })),
      paymentMethod: s.payment_method,
      total: s.total_net,
      status: s.status
    };
  });
}

// Registrar corte de caja
function saveCashCut(cut) {
  const d = initLocalDatabase();
  const info = d.prepare(`
    INSERT INTO cortes_caja (terminal_code, cashier_name, initial_cash, sales_cash, sales_card, sales_transfer, total_sales, counted_cash, difference, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'closed')
  `).run(
    cut.terminal_code || 'C1',
    cut.cashier_name || 'Elena R.',
    parseFloat(cut.initial_cash || 0),
    parseFloat(cut.sales_cash || 0),
    parseFloat(cut.sales_card || 0),
    parseFloat(cut.sales_transfer || 0),
    parseFloat(cut.total_sales || 0),
    parseFloat(cut.counted_cash || 0),
    parseFloat(cut.difference || 0)
  );

  exportBackupJson();
  return { ok: true, id: Number(info.lastInsertRowid) };
}

// ==============================================================================
// RESPALDO EN LA NUBE DIARIO (SUPABASE CLOUD BACKUP)
// ==============================================================================
// Diseñado para evitar race conditions:
// 1. La base local NO es sobrescrita por la nube.
// 2. El respaldo se ejecuta de forma asíncrona enviando un snapshot completo.
// 3. Se sincronizan productos (con su stock actual), ventas pendientes y cortes.
async function performCloudBackup(supabaseClient) {
  if (!supabaseClient) {
    return { ok: false, message: 'Cliente Supabase no configurado' };
  }

  if (isBackingUp) {
    return { ok: false, message: 'Respaldo en progreso' };
  }

  isBackingUp = true;
  const d = initLocalDatabase();

  try {
    console.log('[RESPALDO CLOUD] Iniciando respaldo diario a Supabase...');

    // 1. Snapshot de Productos (stock actual como verdad absoluta)
    const localProducts = d.prepare('SELECT * FROM productos').all();
    if (localProducts.length > 0) {
      const payloadProducts = localProducts.map(p => ({
        barcode: p.codigo_barras,
        sku: p.sku || p.codigo_barras,
        name: p.nombre,
        category: p.categoria || 'Abarrotes',
        cost: parseFloat(p.precio_costo || 0),
        price: parseFloat(p.precio_venta || 0),
        stock: parseInt(p.stock, 10) || 0,
        updated_at: new Date().toISOString()
      }));

      // Upsert por código de barras para no duplicar
      const { error: prodErr } = await supabaseClient
        .from('products')
        .upsert(payloadProducts, { onConflict: 'barcode' });

      if (prodErr) {
        console.warn('[RESPALDO CLOUD] Advertencia al subir productos:', prodErr.message);
      } else {
        console.log(`[RESPALDO CLOUD] ${payloadProducts.length} productos respaldados en Supabase.`);
      }
    }

    // 2. Snapshot de Ventas no respaldadas
    const unsyncedSales = d.prepare('SELECT * FROM ventas WHERE synced_to_cloud = 0 LIMIT 100').all();
    for (const sale of unsyncedSales) {
      try {
        const { data: cloudSale, error: saleErr } = await supabaseClient
          .from('sales')
          .upsert([{
            folio: sale.folio,
            terminal_code: sale.terminal_code,
            terminal_name: sale.terminal_name,
            cashier_name: sale.cashier_name,
            total_items: sale.total_items,
            total_pieces: sale.total_pieces,
            subtotal: sale.subtotal,
            discount: sale.discount,
            total_net: sale.total_net,
            payment_method: sale.payment_method,
            status: sale.status,
            created_at: sale.created_at
          }], { onConflict: 'folio' })
          .select()
          .single();

        if (!saleErr && cloudSale) {
          const items = d.prepare('SELECT * FROM venta_items WHERE folio = ?').all(sale.folio);
          if (items.length > 0) {
            const cloudItems = items.map(it => ({
              sale_id: cloudSale.id,
              barcode: it.barcode,
              sku: it.barcode,
              product_name: it.product_name,
              unit_price: it.unit_price,
              quantity: it.quantity,
              discount: it.discount,
              subtotal: it.subtotal,
              promo_applied: it.promo_applied
            }));
            await supabaseClient.from('sale_items').insert(cloudItems);
          }
          // Marcar como sincronizada
          d.prepare('UPDATE ventas SET synced_to_cloud = 1 WHERE id = ?').run(sale.id);
        }
      } catch (saleEx) {
        console.warn(`[RESPALDO CLOUD] Error en ticket ${sale.folio}:`, saleEx.message);
      }
    }

    // 3. Registrar fecha del último respaldo exitoso
    const nowIso = new Date().toISOString();
    d.prepare(`
      INSERT INTO config_sistema (clave, valor, actualizado_el)
      VALUES ('ultimo_respaldo_cloud', ?, (datetime('now', 'localtime')))
      ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_el = (datetime('now', 'localtime'))
    `).run(nowIso);

    console.log(`[RESPALDO CLOUD] Respaldo completado exitosamente a las ${nowIso}`);
    return { ok: true, timestamp: nowIso, productsBacked: localProducts.length };
  } catch (err) {
    console.error('[RESPALDO CLOUD] Error en proceso de respaldo:', err.message);
    return { ok: false, error: err.message };
  } finally {
    isBackingUp = false;
  }
}

function getBackupStatus() {
  const d = initLocalDatabase();
  const lastRow = d.prepare("SELECT valor, actualizado_el FROM config_sistema WHERE clave = 'ultimo_respaldo_cloud'").get();
  const prodCount = d.prepare('SELECT COUNT(*) AS c FROM productos').get().c;
  const salesCount = d.prepare('SELECT COUNT(*) AS c FROM ventas').get().c;
  const unsyncedCount = d.prepare('SELECT COUNT(*) AS c FROM ventas WHERE synced_to_cloud = 0').get().c;

  return {
    database: 'SQLite Local WAL (Master)',
    totalProducts: prodCount,
    totalSales: salesCount,
    unsyncedSales: unsyncedCount,
    isBackingUp,
    lastBackup: lastRow ? lastRow.valor : null,
    lastBackupFormatted: lastRow ? lastRow.actualizado_el : 'Pendiente'
  };
}

module.exports = {
  initLocalDatabase,
  getProducts,
  findProductByBarcode,
  saveProduct,
  addStock,
  processSale,
  cancelSale,
  getTodaySales,
  saveCashCut,
  performCloudBackup,
  getBackupStatus
};

