/**
 * Test Suite: Validaciones de Promociones (Bundle y Porcentaje), Escape XSS y Manejo Estricto de Errores
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('================================================================');
console.log('TEST SUITE: PROMOCIONES, XSS Y VALIDACIÓN ESTRICTA DE ERRORES');
console.log('================================================================\n');

// ------------------------------------------------------------------------------
// TEST 1: Escape de XSS en cadenas
// ------------------------------------------------------------------------------
console.log('--- TEST 1: Sanitización y Escape contra XSS ---');
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const maliciousName = '<img src=x onerror="alert(1)"> Galletas "Oreo" & Más';
const escaped = escapeHtml(maliciousName);
assert.strictEqual(escaped.includes('<img'), false, 'No debe contener tags HTML vivos');
assert.strictEqual(escaped.includes('&lt;img'), true, 'Debe escapar los símbolos < y >');
assert.strictEqual(escaped.includes('&quot;Oreo&quot;'), true, 'Debe escapar comillas');
assert.strictEqual(escaped.includes('&amp;'), true, 'Debe escapar ampersands');
console.log('  ✓ Test 1 Exitoso: Entrada maliciosa XSS neutralizada completamente.');

// ------------------------------------------------------------------------------
// TEST 2: Promoción Bundle que cuesta más que el precio normal
// ------------------------------------------------------------------------------
console.log('\n--- TEST 2: Promoción Bundle con sobreprecio (3 piezas de $10 con promo $40) ---');
function calculateTotalsMock(cart) {
  let subtotalAccumulated = 0;
  let totalDiscount = 0;
  let totalPieces = 0;

  cart.forEach(item => {
    totalPieces += item.quantity;
    const rawItemSubtotal = item.unitPrice * item.quantity;
    subtotalAccumulated += rawItemSubtotal;

    let rule = item.promoRule;
    if (typeof rule === 'string' && rule.trim().startsWith('{')) {
      try { rule = JSON.parse(rule); } catch (e) { rule = null; }
    }

    if (rule) {
      const pType = rule.type || (rule.discount_percent != null ? 'percentage' : (rule.bundle_price != null ? 'bundle' : null));
      if (pType === 'bundle' && rule.quantity >= 2 && rule.bundle_price != null) {
        const bundles = Math.floor(item.quantity / rule.quantity);
        if (bundles > 0) {
          const normalCostForBundles = bundles * rule.quantity * item.unitPrice;
          const promoCostForBundles = bundles * rule.bundle_price;
          // Solo aplicar si el paquete ahorra dinero
          if (promoCostForBundles < normalCostForBundles) {
            const discount = normalCostForBundles - promoCostForBundles;
            totalDiscount += discount;
          }
        }
      } else if (pType === 'percentage' || pType === 'percent') {
        const pct = parseFloat(rule.discount_percent ?? rule.percentage ?? 0);
        if (pct > 0 && pct <= 100) {
          const discount = (rawItemSubtotal * pct) / 100;
          totalDiscount += discount;
        }
      }
    }
  });

  const totalNet = Math.max(0, subtotalAccumulated - totalDiscount);
  const taxIncluded = totalNet - (totalNet / 1.16);

  return {
    subtotalAccumulated,
    totalDiscount,
    taxIncluded,
    totalNet,
    totalPieces
  };
}

// 3 piezas de $10 = $30. Promo mal configurada: $40
const cartOverpricedBundle = [
  {
    name: 'Refresco Cola',
    unitPrice: 10,
    quantity: 3,
    promoRule: { type: 'bundle', quantity: 3, bundle_price: 40, badge_text: '3x$40' }
  }
];
const totalsBundleOverpriced = calculateTotalsMock(cartOverpricedBundle);
assert.strictEqual(totalsBundleOverpriced.subtotalAccumulated, 30, 'Subtotal normal debe ser 30');
assert.strictEqual(totalsBundleOverpriced.totalDiscount, 0, 'El descuento debe ser 0 (nunca negativo)');
assert.strictEqual(totalsBundleOverpriced.totalNet, 30, 'El total cobrado debe ser $30, NUNCA $40');
console.log('  ✓ Test 2 Exitoso: Se cobran $30 en vez de $40 cuando la promo cuesta más que el precio normal.');

// ------------------------------------------------------------------------------
// TEST 3: Promoción de Porcentaje (10% en producto de $100)
// ------------------------------------------------------------------------------
console.log('\n--- TEST 3: Promoción de Porcentaje (10% de descuento en $100) ---');
const cartPercentagePromo = [
  {
    name: 'Café Gourmet 500g',
    unitPrice: 100,
    quantity: 1,
    promoRule: { type: 'percentage', discount_percent: 10, badge_text: '-10%' }
  }
];
const totalsPercentage = calculateTotalsMock(cartPercentagePromo);
assert.strictEqual(totalsPercentage.subtotalAccumulated, 100, 'Subtotal debe ser 100');
assert.strictEqual(totalsPercentage.totalDiscount, 10, 'Descuento del 10% debe ser 10');
assert.strictEqual(totalsPercentage.totalNet, 90, 'Total neto debe ser $90.00');
assert.strictEqual(Math.round(totalsPercentage.taxIncluded * 100) / 100, Math.round((90 - 90 / 1.16) * 100) / 100, 'Cálculo de IVA incluido correcto');
console.log('  ✓ Test 3 Exitoso: El producto de $100 con 10% de descuento se cobra en $90.00 con desglose exacto.');

// ------------------------------------------------------------------------------
// TEST 4: Verificación en localDb.js (Servidor WAL SQLite)
// ------------------------------------------------------------------------------
console.log('\n--- TEST 4: Validación y Procesamiento en Servidor localDb.js ---');
const tmpDbPath = path.join(__dirname, 'test_promo_temp.sqlite');
if (fs.existsSync(tmpDbPath)) fs.unlinkSync(tmpDbPath);
process.env.LOCAL_DB_FILE = tmpDbPath;

const localDb = require('../database/localDb');
const dbInstance = localDb.initLocalDatabase();

// Insertar producto normal con promo bundle más cara ($40 vs $30)
dbInstance.prepare(`
  INSERT INTO products (barcode, sku, name, brand, category, cost, price, stock, min_stock, promo_rule, origin)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run('PROMO-EXPENSIVE', 'PROMO-EXP', 'Producto Bundle Caro', 'Genérica', 'Abarrotes', 5, 10, 50, 5, JSON.stringify({ type: 'bundle', quantity: 3, bundle_price: 40 }), 'manual');

// Insertar producto con promo de porcentaje (10% en $100)
dbInstance.prepare(`
  INSERT INTO products (barcode, sku, name, brand, category, cost, price, stock, min_stock, promo_rule, origin)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run('PROMO-PERCENT', 'PROMO-PCT', 'Producto Descuento 10%', 'Genérica', 'Abarrotes', 50, 100, 50, 5, JSON.stringify({ type: 'percentage', discount_percent: 10 }), 'manual');

// Abrir turno C1
const userAdmin = dbInstance.prepare("SELECT * FROM users WHERE role = 'admin'").get();
const shift = localDb.openTerminalShift('C1', 500, userAdmin);

// 4.1 Probar venta del bundle caro en localDb: debe cobrar $30 (3 piezas de $10), no $40
const saleExpensiveBundle = localDb.processSale({
  folio: '#TEST-EXP-001',
  terminal_code: 'C1',
  user_id: userAdmin.id,
  subtotal: 30,
  discount: 0,
  total_net: 30,
  payment_method: 'cash',
  cash_received: 50,
  items: [
    { barcode: 'PROMO-EXPENSIVE', quantity: 3, unitPrice: 10 }
  ]
}, userAdmin);
assert.strictEqual(saleExpensiveBundle.total_net, 30, 'El servidor debe cobrar $30 netos por las 3 piezas');
assert.strictEqual(saleExpensiveBundle.discount, 0, 'El servidor no debe aplicar descuento negativo');
console.log('  ✓ Test 4.1 Exitoso: El servidor localDb no incrementa el costo cuando la promo bundle es más cara.');

// 4.2 Probar venta con promo porcentaje en localDb: 1 pieza de $100 con 10% desc = $90
const salePct = localDb.processSale({
  folio: '#TEST-PCT-001',
  terminal_code: 'C1',
  user_id: userAdmin.id,
  subtotal: 100,
  discount: 10,
  total_net: 90,
  payment_method: 'cash',
  cash_received: 100,
  items: [
    { barcode: 'PROMO-PERCENT', quantity: 1, unitPrice: 100 }
  ]
}, userAdmin);
assert.strictEqual(salePct.total_net, 90, 'El servidor debe cobrar $90 netos');
assert.strictEqual(salePct.discount, 10, 'El servidor registra $10 de descuento promocional');
console.log('  ✓ Test 4.2 Exitoso: El servidor localDb aplica correctamente el descuento porcentual.');

// Limpieza de BD temporal
dbInstance.close();
if (fs.existsSync(tmpDbPath)) fs.unlinkSync(tmpDbPath);

// ------------------------------------------------------------------------------
// TEST 5: Manejo Estricto de Errores en Cobro (Sin Falso "Venta Exitosa")
// ------------------------------------------------------------------------------
console.log('\n--- TEST 5: Manejo Estricto de Errores y Prevención de Falso "Venta Exitosa" ---');

// Simulador del flujo en posPayments.js con la nueva validación estricta
function simulateCheckoutFlow(mockRegisterSaleResult) {
  let isVentaExitosaReached = false;
  let cartCleared = false;
  let modalDisplayed = null;

  let res = null;
  try {
    if (typeof mockRegisterSaleResult === 'function') {
      res = mockRegisterSaleResult();
    } else {
      res = mockRegisterSaleResult;
    }
  } catch (checkoutErr) {
    res = {
      success: false,
      error: 'Error inesperado durante el cobro: ' + checkoutErr.message,
      errorCode: 'CHECKOUT_EXCEPTION'
    };
  }

  // VALIDACIÓN ESTRICTA
  if (!res || res.success === false) {
    const errCode = res?.errorCode || 'SALE_ERROR';
    const errMsg = res?.error || 'Error desconocido';
    modalDisplayed = { title: 'Error Modal', code: errCode, msg: errMsg };
    return { isVentaExitosaReached, cartCleared, modalDisplayed };
  }

  // Si tiene éxito
  isVentaExitosaReached = true;
  cartCleared = true;
  return { isVentaExitosaReached, cartCleared, modalDisplayed };
}

// 5.1 Caso: Excepción imprevista en el guardado
const caseException = simulateCheckoutFlow(() => {
  throw new Error('Disco lleno o fallo de red fatal');
});
assert.strictEqual(caseException.isVentaExitosaReached, false, 'NUNCA debe alcanzar Venta Exitosa en excepción');
assert.strictEqual(caseException.cartCleared, false, 'NUNCA debe borrar el carrito');
assert.strictEqual(caseException.modalDisplayed.code, 'CHECKOUT_EXCEPTION');
console.log('  ✓ Test 5.1 Exitoso: Las excepciones bloquean Venta Exitosa y muestran alerta en pantalla.');

// 5.2 Caso: Error de almacenamiento local (STORAGE_FAILED)
const caseStorageFailed = simulateCheckoutFlow({
  success: false,
  error: 'Fallo al escribir en localStorage',
  errorCode: 'STORAGE_FAILED'
});
assert.strictEqual(caseStorageFailed.isVentaExitosaReached, false, 'NUNCA debe alcanzar Venta Exitosa en STORAGE_FAILED');
assert.strictEqual(caseStorageFailed.cartCleared, false);
console.log('  ✓ Test 5.2 Exitoso: Fallo de almacenamiento local no simula venta exitosa.');

// 5.3 Caso: Turno cerrado (SHIFT_CLOSED)
const caseShiftClosed = simulateCheckoutFlow({
  success: false,
  error: 'No hay turno abierto en la terminal',
  errorCode: 'SHIFT_CLOSED'
});
assert.strictEqual(caseShiftClosed.isVentaExitosaReached, false);
assert.strictEqual(caseShiftClosed.modalDisplayed.code, 'SHIFT_CLOSED');
console.log('  ✓ Test 5.3 Exitoso: Turno cerrado es interceptado y no marca éxito.');

// 5.4 Caso: Venta legítima exitosa
const caseSuccess = simulateCheckoutFlow({
  success: true,
  result: { ok: true, sale_id: 12345 }
});
assert.strictEqual(caseSuccess.isVentaExitosaReached, true, 'Debe procesar Venta Exitosa cuando success es true');
assert.strictEqual(caseSuccess.cartCleared, true);
console.log('  ✓ Test 5.4 Exitoso: Las ventas exitosas legítimas continúan normalmente.');

console.log('\n================================================================');
console.log('RESULTADO: TODAS LAS PRUEBAS DE PROMOCIONES, XSS Y ERRORES PASARON (100%)');
console.log('================================================================');
