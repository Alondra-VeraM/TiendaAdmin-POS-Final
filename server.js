/**
 * ==============================================================================
 * BACKEND EXPRESS - PARSEO DE CFDI XML Y SINCRONIZACIÓN DE STOCK
 * ==============================================================================
 * Recibe facturas electrónicas mexicanas en formato XML (CFDI 3.3 y 4.0),
 * extrae conceptos con 'xml2js', resuelve códigos padre de empaque (cajas)
 * y actualiza el stock y los costos en tiempo real en Supabase (y local).
 * ==============================================================================
 */

const express = require('express');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createClient } = require('@supabase/supabase-js');
const { testConnection } = require('./database/db');
const localDb = require('./database/localDb');
const inventoryController = require('./controllers/inventoryController');

// Inicializar la base de datos local (Master)
localDb.initLocalDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qluxojdodesadfthugml.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsdXhvamRvZGVzYWRmdGh1Z21sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxODM5NTUsImV4cCI6MjEwNzc1OTk1NX0.t5etK56r6Z2qsHPtjni7wnN1AmUSDEfQXG_4Roum2u0';

let supabase = null;
try {
  if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (e) {
  console.warn('⚠️ No se pudo inicializar Supabase en backend:', e.message);
}

// Middlewares
app.use(express.json({ limit: '15mb' }));
app.use(express.text({ type: ['text/xml', 'application/xml'], limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Servir frontend estático desde www (sin interceptar index.html en raíz)
app.use(express.static(path.join(__dirname, 'www'), { index: false }));

// CORS para pruebas locales
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Función auxiliar para extraer atributo sin importar mayúsculas/minúsculas
function getAttr(obj, name) {
  if (!obj || !obj['$']) return '';
  const dollar = obj['$'];
  if (dollar[name] !== undefined) return dollar[name];
  const lower = name.toLowerCase();
  for (const k of Object.keys(dollar)) {
    if (k.toLowerCase() === lower) return dollar[k];
  }
  return '';
}

// Búsqueda de nodo recursiva insensible a prefijos de namespace (cfdi:, tfd:, etc.)
function findNode(obj, localName) {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of Object.keys(obj)) {
    const cleanKey = key.includes(':') ? key.split(':')[1] : key;
    if (cleanKey.toLowerCase() === localName.toLowerCase()) {
      return obj[key];
    }
    if (typeof obj[key] === 'object') {
      const nested = findNode(obj[key], localName);
      if (nested) return nested;
    }
  }
  return null;
}

/**
 * ENDPOINT: POST /api/cfdi
 * Recibe el XML del CFDI y procesa la entrada masiva de inventario
 */
app.post(['/api/cfdi', '/api/cfdi/parse'], async (req, res) => {
  try {
    let xmlContent = '';
    if (typeof req.body === 'string') {
      xmlContent = req.body;
    } else if (req.body && typeof req.body.xml === 'string') {
      xmlContent = req.body.xml;
    } else {
      return res.status(400).json({ ok: false, error: 'No se envió contenido XML en la petición.' });
    }

    if (!xmlContent || !xmlContent.trim()) {
      return res.status(400).json({ ok: false, error: 'El archivo XML está vacío.' });
    }

    // 1. Parseo con xml2js
    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
    const parsed = await parser.parseStringPromise(xmlContent);

    // 2. Extraer Comprobante, Emisor, Timbre
    const compKey = Object.keys(parsed).find(k => k.toLowerCase().includes('comprobante'));
    if (!compKey) {
      return res.status(400).json({ ok: false, error: 'El archivo XML no corresponde a un Comprobante CFDI válido.' });
    }
    const comprobante = parsed[compKey];
    const emisor = findNode(comprobante, 'Emisor') || {};
    const timbre = findNode(comprobante, 'TimbreFiscalDigital') || {};

    const uuid = getAttr(timbre, 'UUID');
    const serie = getAttr(comprobante, 'Serie');
    const folioNumber = getAttr(comprobante, 'Folio');
    const folio = [serie, folioNumber].filter(Boolean).join('-') || folioNumber || 'S/F';
    const total = parseFloat(getAttr(comprobante, 'Total')) || 0;
    const supplierName = getAttr(emisor, 'Nombre') || 'Proveedor Desconocido';
    const supplierRfc = getAttr(emisor, 'Rfc') || '';

    // 3. Validar si la factura ya fue procesada antes
    if (uuid && supabase) {
      try {
        const { data: existing } = await supabase
          .from('supplier_invoices')
          .select('uuid, folio, created_at')
          .eq('uuid', uuid)
          .maybeSingle();

        if (existing) {
          return res.status(200).json({
            ok: false,
            alreadyProcessed: true,
            error: `Esta factura (UUID: ${uuid}, Folio: ${existing.folio}) ya fue registrada previamente.`
          });
        }
      } catch (err) {}
    }

    // 4. Extraer lista de conceptos
    const conceptosNode = findNode(comprobante, 'Conceptos');
    if (!conceptosNode) {
      return res.status(400).json({ ok: false, error: 'La factura no contiene el nodo de conceptos.' });
    }

    let conceptoList = findNode(conceptosNode, 'Concepto');
    if (!Array.isArray(conceptoList)) {
      conceptoList = conceptoList ? [conceptoList] : [];
    }

    const items = conceptoList.map(c => ({
      code: getAttr(c, 'NoIdentificacion').trim(),
      description: getAttr(c, 'Descripcion').trim(),
      quantity: Math.max(1, Math.round(parseFloat(getAttr(c, 'Cantidad')) || 0)),
      unitCost: parseFloat(getAttr(c, 'ValorUnitario')) || 0,
      importAmount: parseFloat(getAttr(c, 'Importe')) || 0
    }));

    if (items.length === 0) {
      return res.status(400).json({ ok: false, error: 'No se encontraron conceptos dentro de la factura.' });
    }

    // 5. Cargar catálogo de productos y códigos de empaque (cajas)
    let dbProducts = [];
    let dbPackages = [];

    if (supabase) {
      try {
        const [prodRes, pkgRes] = await Promise.all([
          supabase.from('products').select('*'),
          supabase.from('product_packages').select('*')
        ]);
        if (prodRes.data) dbProducts = prodRes.data;
        if (pkgRes.data) dbPackages = pkgRes.data;
      } catch (e) {
        console.warn('Error leyendo catálogo de Supabase:', e.message);
      }
    }

    // Si Supabase no responde, leer del catálogo de respaldo
    if (dbProducts.length === 0) {
      dbProducts = [
        { id: 1, barcode: '7501820511234', name: 'Leche Lala Entera 1L', cost: 22.50, stock: 34 },
        { id: 2, barcode: '750185538472', name: 'Coca-Cola Original 600ml', cost: 14.00, stock: 42 },
        { id: 3, barcode: '750103912089', name: 'Aceite Nutrioli 850ml', cost: 36.00, stock: 4 },
        { id: 4, barcode: '750188881235', name: 'Huevo Blanco San Juan 1kg', cost: 42.00, stock: 15 },
        { id: 5, barcode: '750954123456', name: 'Pan Bimbo Blanco 680g', cost: 28.00, stock: 0 },
        { id: 12, barcode: '750456789321', name: 'Agua Ciel 1.5L', cost: 12.00, stock: 33 }
      ];
      dbPackages = [
        { barcode: '17501820511231', product_id: 1, units: 12, description: 'Caja Leche Lala Entera 1L (12 pzas)' },
        { barcode: '17501855384729', product_id: 2, units: 24, description: 'Caja Coca-Cola 600ml (24 pzas)' }
      ];
    }

    // 6. Cruzar conceptos de la factura con la base de datos
    let totalPiecesAdded = 0;
    const processedDetails = [];
    const notFound = [];

    for (const item of items) {
      let matchedProduct = null;
      let unitsPerItem = 1;
      let isPackage = false;

      // Paso A: ¿Es un código de pieza directo?
      matchedProduct = dbProducts.find(p => 
        (p.barcode && p.barcode.toLowerCase() === item.code.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase() === item.code.toLowerCase())
      );

      // Paso B: ¿Es un código padre de caja / empaque?
      if (!matchedProduct) {
        const pkgMatch = dbPackages.find(b => b.barcode && b.barcode.toLowerCase() === item.code.toLowerCase());
        if (pkgMatch) {
          matchedProduct = dbProducts.find(p => Number(p.id) === Number(pkgMatch.product_id));
          if (matchedProduct) {
            unitsPerItem = parseInt(pkgMatch.units, 10) || 1;
            isPackage = true;
          }
        }
      }

      // Paso C: Coincidencia por nombre aproximado
      if (!matchedProduct && item.description) {
        const descClean = item.description.toLowerCase();
        matchedProduct = dbProducts.find(p => {
          const nameClean = (p.name || '').toLowerCase();
          return descClean.includes(nameClean) || nameClean.includes(descClean);
        });
      }

      if (!matchedProduct) {
        notFound.push({ code: item.code, description: item.description });
        continue;
      }

      // Calcular unidades a sumar y costo unitario real de mostrador
      const piecesToAdd = item.quantity * unitsPerItem;
      const unitCostPiece = isPackage 
        ? Math.round((item.unitCost / unitsPerItem) * 100) / 100 
        : item.unitCost;

      const previousStock = parseInt(matchedProduct.stock, 10) || 0;
      const newStock = previousStock + piecesToAdd;

      // Actualizar en memoria
      matchedProduct.stock = newStock;
      if (unitCostPiece > 0) matchedProduct.cost = unitCostPiece;
      totalPiecesAdded += piecesToAdd;

      // Actualizar en Supabase
      if (supabase) {
        try {
          await supabase
            .from('products')
            .update({ stock: newStock, cost: unitCostPiece })
            .eq('id', matchedProduct.id);

          await supabase.from('inventory_movements').insert([{
            product_id: matchedProduct.id,
            movement_type: 'purchase_entry',
            quantity: piecesToAdd,
            previous_stock: previousStock,
            new_stock: newStock,
            unit_cost: unitCostPiece,
            notes: isPackage
              ? `Entrada CFDI Factura ${folio}: ${item.quantity} caja(s) de ${unitsPerItem} pzas (${item.description})`
              : `Entrada CFDI Factura ${folio}: ${piecesToAdd} pzas (${item.description})`,
            created_by: `CFDI - ${supplierName}`.slice(0, 95)
          }]);
        } catch (err) {
          console.warn(`Error actualizando producto ${matchedProduct.id} en Supabase:`, err.message);
        }
      }

      processedDetails.push({
        code: item.code,
        description: item.description,
        productName: matchedProduct.name,
        isPackage,
        boxes: isPackage ? item.quantity : 0,
        unitsPerBox: isPackage ? unitsPerItem : 1,
        unitsAdded: piecesToAdd,
        unitCost: unitCostPiece,
        newStock
      });
    }

    // 7. Registrar factura en supplier_invoices
    if (supabase && uuid) {
      try {
        await supabase.from('supplier_invoices').insert([{
          uuid,
          supplier_name: supplierName,
          supplier_rfc: supplierRfc,
          folio,
          total,
          pieces_added: totalPiecesAdded
        }]);
      } catch (err) {}
    }

    console.log(`✅ [CFDI Parse] Factura ${folio} de "${supplierName}" procesada: +${totalPiecesAdded} piezas en ${processedDetails.length} productos.`);

    return res.status(200).json({
      ok: true,
      uuid,
      folio,
      supplier: supplierName,
      rfc: supplierRfc,
      total,
      piecesAdded: totalPiecesAdded,
      productsUpdated: processedDetails.length,
      unmatchedCount: notFound.length,
      details: processedDetails,
      unmatched: notFound
    });

  } catch (error) {
    console.error('Error procesando factura CFDI en backend:', error);
    return res.status(500).json({ ok: false, error: 'Error interno al procesar el archivo XML: ' + error.message });
  }
});

// ==============================================================================
// RUTAS: MÓDULO DE RECEPCIÓN DE INVENTARIO (MySQL + Open Food Facts API + LAN)
// ==============================================================================

// Cola en memoria de escaneos recibidos desde el celular hacia el POS
let pendingPosScans = [];

// Enviar escaneo desde el lector móvil hacia el Punto de Venta
app.post('/api/pos/scan', (req, res) => {
  const { barcode, mode = 'sale', quantity = 1, metadata = {} } = req.body || {};
  if (!barcode) {
    return res.status(400).json({ ok: false, error: 'Código de barras requerido' });
  }

  const scanEvent = {
    id: Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    barcode: String(barcode).trim(),
    mode,
    quantity: parseInt(quantity, 10) || 1,
    metadata,
    timestamp: new Date().toISOString()
  };

  pendingPosScans.push(scanEvent);
  if (pendingPosScans.length > 50) pendingPosScans.shift();

  console.log(`[LAN SCAN] Código recibido desde móvil: ${scanEvent.barcode} (Modo: ${mode}, Cant: ${scanEvent.quantity})`);
  res.json({ ok: true, message: 'Código enviado al POS con éxito', scan: scanEvent });
});

// Consumir escaneos pendientes para el Punto de Venta
app.get('/api/pos/scans', (req, res) => {
  const scans = [...pendingPosScans];
  pendingPosScans = [];
  res.json({ ok: true, count: scans.length, scans });
});

// Ping de conectividad LAN para la app móvil
app.get('/api/pos/ping', (req, res) => {
  res.json({ ok: true, pos: 'online', service: 'POS Retail Server', timestamp: new Date().toISOString() });
});

// Rutas para el Punto de Venta Desktop
app.get(['/pos', '/pos.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'www', 'pos.html'));
});

// Rutas para el escáner / lector móvil
app.get(['/scanner', '/lector', '/recepcion'], (req, res) => {
  res.sendFile(path.join(__dirname, 'www', 'index.html'));
});

// Raíz inteligente: si es móvil va al lector de códigos, si es PC va al POS
app.get('/', (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  if (isMobile) {
    res.sendFile(path.join(__dirname, 'www', 'index.html'));
  } else {
    res.sendFile(path.join(__dirname, 'www', 'pos.html'));
  }
});

// Búsqueda: MySQL -> Open Food Facts -> Cola Offline
app.get('/api/producto/:codigo', inventoryController.buscarProducto);

// Guardar nuevo producto o actualizar desde tabla editable / celular
app.post(['/api/producto', '/api/pos/add-inventory'], (req, res, next) => {
  const barcode = req.body.codigo_barras || req.body.barcode;
  const name = req.body.nombre || req.body.name;
  const category = req.body.categoria || req.body.category || 'Abarrotes';
  const price = parseFloat(req.body.precio || req.body.precio_venta || req.body.price || 0);
  const cost = parseFloat(req.body.costo || req.body.precio_costo || req.body.cost || 0);
  const qty = parseInt(req.body.cantidad || req.body.cantidad_entrante || req.body.quantity || 1, 10);

  if (barcode) {
    const invEvent = {
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      mode: 'inventory_add',
      barcode: String(barcode).trim(),
      name: name || `Producto ${barcode}`,
      category,
      price,
      cost,
      quantity: qty,
      timestamp: new Date().toISOString()
    };
    pendingPosScans.push(invEvent);
    console.log(`[LAN INVENTARIO] Notificado al POS: ${invEvent.name} (+${qty} pzas)`);
  }
  next();
}, inventoryController.guardarProducto);

// Entrada rápida de stock para producto existente
app.post('/api/producto/sumar-stock', inventoryController.sumarStock);

// Cola de códigos guardados en modo offline
app.get('/api/cola-pendientes', inventoryController.obtenerColaPendientes);

// Endpoint de prueba de salud
app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'online', service: 'TiendaAdmin Backend' });
});

// ==============================================================================
// RUTAS POS LOCAL MASTER (ALTA VELOCIDAD Y ACTUALIZACIÓN ATÓMICA DE STOCK)
// ==============================================================================

// 1. Obtener todos los productos del inventario (Supabase primario)
app.get('/api/pos/products', async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase.from('products').select('*').eq('is_active', true).order('name');
      if (!error && Array.isArray(data) && data.length > 0) {
        return res.json({ ok: true, count: data.length, products: data });
      }
    }
    const products = localDb.getProducts();
    res.json({ ok: true, count: products.length, products });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 2. Procesar venta atómica en Supabase con descuento y validación de turno
app.post('/api/pos/sale', async (req, res) => {
  try {
    const { folio, total_items, total_pieces, subtotal, discount, total_net, payment_method, cart, items, terminal_code, terminal_name, cashier_name } = req.body || {};
    const saleItems = cart || items || [];
    
    if (!saleItems || saleItems.length === 0) {
      return res.status(400).json({ ok: false, error: 'La venta debe contener al menos 1 artículo' });
    }

    if (supabase) {
      const formattedItems = saleItems.map(it => ({
        id: it.id,
        barcode: it.barcode || it.sku,
        sku: it.sku || it.barcode,
        name: it.name,
        unitPrice: parseFloat(it.unitPrice || it.price || 0),
        quantity: parseInt(it.quantity, 10) || 1,
        discount: parseFloat(it.discount || 0),
        subtotal: parseFloat(it.subtotal || ((it.unitPrice || it.price || 0) * (it.quantity || 1)))
      }));

      const { data, error } = await supabase.rpc('register_sale_atomic', {
        p_folio: folio,
        p_terminal_code: terminal_code || 'C1',
        p_terminal_name: terminal_name || 'Caja 1',
        p_cashier_name: cashier_name || 'Cajero',
        p_subtotal: parseFloat(subtotal || total_net || 0),
        p_discount: parseFloat(discount || 0),
        p_total_net: parseFloat(total_net || 0),
        p_payment_method: payment_method || 'cash',
        p_items: formattedItems
      });

      if (error) {
        return res.status(400).json({ ok: false, error: error.message });
      }
      return res.json(data);
    }

    const result = localDb.processSale({
      folio,
      total_items,
      total_pieces,
      subtotal,
      discount,
      total_net,
      payment_method
    }, saleItems);

    res.json(result);
  } catch (err) {
    console.error('[API POS SALE ERROR]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 3. Cancelar venta y restituir existencias
app.post('/api/pos/cancel-sale', async (req, res) => {
  try {
    const { folio, reason } = req.body || {};
    if (!folio) return res.status(400).json({ ok: false, error: 'Folio requerido' });

    if (supabase) {
      const { error } = await supabase
        .from('sales')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason || 'Cancelación de venta'
        })
        .eq('folio', folio);

      if (!error) return res.json({ ok: true, folio, status: 'cancelled' });
    }

    const result = localDb.cancelSale(folio, reason);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 4. Historial de ventas (Supabase primario)
app.get('/api/pos/sales', async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && Array.isArray(data)) {
        return res.json({ ok: true, count: data.length, sales: data });
      }
    }
    const sales = localDb.getTodaySales();
    res.json({ ok: true, count: sales.length, sales });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 5. Corte de caja local
app.post('/api/pos/cash-cut', (req, res) => {
  try {
    const result = localDb.saveCashCut(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 6. Estado del respaldo en la nube
app.get('/api/pos/backup-status', (req, res) => {
  try {
    const status = localDb.getBackupStatus();
    res.json({ ok: true, ...status });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 7. Ejecutar respaldo diario en la nube (On-demand o programado)
app.post('/api/pos/backup-cloud', async (req, res) => {
  try {
    const result = await localDb.performCloudBackup(supabase);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Tarea programada: Respaldo diario automático en la nube (cada 24 horas)
setInterval(async () => {
  try {
    if (supabase) {
      console.log('[CRON DIARIO] Verificando respaldo programado en la nube...');
      await localDb.performCloudBackup(supabase);
    }
  } catch (cronErr) {
    console.warn('[CRON DIARIO] Respaldo no pudo completarse:', cronErr.message);
  }
}, 24 * 60 * 60 * 1000); // 24 horas

// Helper para obtener IPs locales LAN (Wi-Fi / Ethernet)
function getLanIps() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Filtrar sólo IPv4 que no sean loopback (127.0.0.1)
      if (net.family === 'IPv4' && !net.internal) {
        results.push({ interface: name, ip: net.address });
      }
    }
  }
  return results;
}

// Iniciar servidor en 0.0.0.0 para acceso inalámbrico desde la LAN (celular)
app.listen(PORT, '0.0.0.0', async () => {
  console.log('================================================================');
  console.log(`TIENDAADMIN - SERVIDOR INICIADO EN EL PUERTO ${PORT}`);
  console.log('================================================================');
  console.log(`PC Local:        http://localhost:${PORT}`);
  console.log(`PC Recepción:    http://localhost:${PORT}/recepcion`);
  
  const lanIps = getLanIps();
  if (lanIps.length > 0) {
    console.log('----------------------------------------------------------------');
    console.log('ESCÁNER INALÁMBRICO DESDE CELULAR (Misma red Wi-Fi):');
    lanIps.forEach(net => {
      console.log(`  -> [${net.interface}] http://${net.ip}:${PORT}/recepcion`);
    });
    console.log('----------------------------------------------------------------');
  } else {
    console.log(`Celular (LAN):   http://<IP-DE-TU-PC>:${PORT}/recepcion`);
  }

  console.log(`API Producto:    GET  /api/producto/:codigo`);
  console.log(`API Guardar:     POST /api/producto`);
  console.log(`API CFDI Fact.:  POST /api/cfdi`);
  console.log('================================================================');

  // Probar conexión a MySQL
  await testConnection();
});

