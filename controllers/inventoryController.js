/**
 * ==============================================================================
 * CONTROLADOR DE RECEPCIÓN DE INVENTARIO (Local DB Master + Open Food Facts API)
 * ==============================================================================
 */

const localDb = require('../database/localDb');
const { getPool, isDbConnected } = require('../database/db');

// Cargar catálogo de México como fallback
try {
  require('../www/js/mexicoBarcodes');
} catch (e) {}

/**
 * Consulta silenciosa de Open Food Facts con timeout de 3.5 segundos
 */
async function fetchOpenFoodFacts(barcode) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'TiendaAdmin-POS - Web - Version 2.0 (recepcion-inventario)'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { found: false, offline: false };
    }

    const data = await response.json();
    if (data && data.status === 1 && data.product) {
      const p = data.product;
      const nombreBase = (p.product_name_es || p.product_name || p.generic_name_es || p.generic_name || '').trim();
      const marca = (p.brands || p.brand_owner || '').split(',')[0].trim();
      let categoria = (p.categories || p.categories_old || '').split(',')[0].trim();
      const contenido = String(p.quantity || '').trim();

      // Normalizar categoría
      const catLower = categoria.toLowerCase();
      if (catLower.includes('beverage') || catLower.includes('bebida') || catLower.includes('refresco') || catLower.includes('agua') || catLower.includes('jugo')) {
        categoria = 'Bebidas y Refrescos';
      } else if (catLower.includes('dairy') || catLower.includes('lácteo') || catLower.includes('leche') || catLower.includes('queso') || catLower.includes('yogur')) {
        categoria = 'Lácteos y Cremería';
      } else if (catLower.includes('snack') || catLower.includes('botana') || catLower.includes('papas') || catLower.includes('fritura')) {
        categoria = 'Botanas';
      } else if (catLower.includes('bread') || catLower.includes('pan') || catLower.includes('galleta') || catLower.includes('bakery')) {
        categoria = 'Panadería';
      } else if (catLower.includes('clean') || catLower.includes('limpieza') || catLower.includes('jabón') || catLower.includes('detergente')) {
        categoria = 'Limpieza e Higiene';
      } else if (!categoria) {
        categoria = 'Abarrotes y Granos';
      }

      // Nombre completo limpio
      let nombre = nombreBase;
      if (marca && !nombre.toLowerCase().includes(marca.toLowerCase().split(' ')[0])) {
        nombre = `${marca} ${nombre}`.trim();
      }
      if (contenido && !nombre.toLowerCase().includes(contenido.toLowerCase())) {
        nombre = `${nombre} ${contenido}`.trim();
      }

      return {
        found: true,
        offline: false,
        product: {
          codigo_barras: barcode,
          nombre: nombre,
          marca: marca,
          categoria: categoria,
          contenido: contenido
        }
      };
    }

    return { found: false, offline: false };
  } catch (err) {
    clearTimeout(timeoutId);
    return { found: false, offline: true, error: err.message };
  }
}

/**
 * 1. BÚSQUEDA SILENCIOSA DE PRODUCTO: Local DB -> Open Food Facts -> Manual
 * GET /api/producto/:codigo
 */
async function buscarProducto(req, res) {
  const codigo = String(req.params.codigo || '').trim();
  if (!codigo) {
    return res.status(400).json({ error: 'El código de barras es requerido' });
  }

  // PASO 1: Buscar en Base de Datos Local (Master)
  try {
    const localProd = localDb.findProductByBarcode(codigo);
    if (localProd) {
      return res.json({
        status: 'existing',
        origen: 'local',
        product: {
          id: localProd.id,
          codigo_barras: localProd.barcode,
          nombre: localProd.name,
          marca: localProd.brand || '',
          categoria: localProd.category || 'Abarrotes',
          precio_costo: localProd.cost,
          precio_venta: localProd.price,
          stock: localProd.stock
        }
      });
    }
  } catch (e) {
    console.warn('[LOCAL DB] Error buscando producto:', e.message);
  }

  // PASO 2: Si no existe localmente, consultar API de Open Food Facts
  const offResult = await fetchOpenFoodFacts(codigo);

  if (offResult.found) {
    return res.json({
      status: 'openfoodfacts',
      origen: 'openfoodfacts',
      product: {
        codigo_barras: offResult.product.codigo_barras,
        nombre: offResult.product.nombre,
        marca: offResult.product.marca,
        categoria: offResult.product.categoria,
        precio_costo: '',
        precio_venta: '',
        stock: 1
      }
    });
  }

  // PASO 3: Si no está en Open Food Facts, buscar en el catálogo de productos comunes
  if (typeof global.lookupMexicoBarcode === 'function') {
    const match = global.lookupMexicoBarcode(codigo);
    if (match) {
      return res.json({
        status: 'catalog',
        origen: 'catalogo_nacional',
        product: {
          codigo_barras: codigo,
          nombre: match.name || '',
          marca: match.brand || '',
          categoria: match.category || 'Abarrotes',
          precio_costo: match.suggestedCost || '',
          precio_venta: match.suggestedPrice || '',
          stock: 1
        }
      });
    }
  }

  // PASO 4: No encontrado o sin conexión -> devolver estructura limpia para captura manual
  return res.json({
    status: 'manual',
    origen: 'manual',
    product: {
      codigo_barras: codigo,
      nombre: '',
      marca: '',
      categoria: 'Abarrotes',
      precio_costo: '',
      precio_venta: '',
      stock: 1
    }
  });
}

/**
 * 2. GUARDAR PRODUCTO EN BASE DE DATOS LOCAL
 * POST /api/producto
 */
async function guardarProducto(req, res) {
  const barcode = req.body.codigo_barras || req.body.barcode;
  const name = req.body.nombre || req.body.name;
  const brand = req.body.marca || req.body.brand || '';
  const category = req.body.categoria || req.body.category || 'Abarrotes';
  const cost = parseFloat(req.body.precio_costo || req.body.costo || req.body.cost || 0);
  const price = parseFloat(req.body.precio_venta || req.body.precio || req.body.price || 0);
  const stock = parseInt(req.body.stock || req.body.cantidad_entrante || req.body.cantidad || 0, 10);
  const origin = req.body.origen || req.body.origen_datos || 'manual';

  if (!barcode || !name) {
    return res.status(400).json({ error: 'Código de barras y nombre son requeridos' });
  }

  try {
    const saved = localDb.saveProduct({
      barcode,
      name,
      brand,
      category,
      cost,
      price,
      stock,
      origen: origin
    });

    // Mirroring a MySQL si está disponible
    const pool = getPool();
    if (isDbConnected() && pool) {
      try {
        await pool.query(`
          INSERT INTO productos (codigo_barras, nombre, marca, categoria, precio_costo, precio_venta, stock, origen_datos)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            nombre = VALUES(nombre), marca = VALUES(marca), categoria = VALUES(categoria),
            precio_costo = VALUES(precio_costo), precio_venta = VALUES(precio_venta), stock = VALUES(stock)
        `, [barcode, name, brand, category, cost, price, stock, origin]);
      } catch (myErr) {
        console.warn('[MYSQL SYNC] Advertencia al sincronizar producto en MySQL:', myErr.message);
      }
    }

    return res.json({
      success: true,
      producto: saved
    });
  } catch (err) {
    console.error('[LOCAL DB] Error al guardar producto:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * 3. SUMAR STOCK A PRODUCTO EXISTENTE
 * POST /api/producto/sumar-stock
 */
async function sumarStock(req, res) {
  const barcode = req.body.codigo_barras || req.body.barcode;
  const qty = parseInt(req.body.cantidad, 10) || 1;
  const unitCost = req.body.precio_costo ? parseFloat(req.body.precio_costo) : null;

  if (!barcode || qty <= 0) {
    return res.status(400).json({ error: 'Código y cantidad válida requeridos' });
  }

  try {
    const updated = localDb.addStock(barcode, qty, unitCost, 'Entrada rápida por escáner');
    return res.json({
      success: true,
      producto: updated
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * 4. COLA DE PENDIENTES
 */
async function obtenerColaPendientes(req, res) {
  return res.json([]);
}

module.exports = {
  buscarProducto,
  guardarProducto,
  sumarStock,
  obtenerColaPendientes
};
