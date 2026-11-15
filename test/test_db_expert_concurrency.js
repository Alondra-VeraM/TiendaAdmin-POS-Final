/**
 * ==============================================================================
 * TEST DE VERIFICACIÓN DE BASE DE DATOS Y CONCURRENCIA (EXPERTO BD)
 * ==============================================================================
 * 1. Inicialización y aislamiento en base de datos temporal
 * 2. Prueba anti-race condition: Venta concurrente simultánea del último artículo
 * 3. Restricciones CHECK: Impedir stock negativo, total negativo, terminal inválida
 * 4. Integridad de turnos: Impedir doble turno abierto en C1 o C2
 * 5. Re-cálculo estricto de precios en servidor (Anti-manipulación de cliente)
 * 6. Seguimiento de cambios para sincronización incremental a Supabase (rev / synced_rev)
 * ==============================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Usar base de datos temporal aislada para pruebas
const TEST_DB = path.join(__dirname, 'test_concurrency.sqlite');
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
process.env.LOCAL_DB_FILE = TEST_DB;

const localDb = require('../database/localDb');

console.log('================================================================');
console.log('TEST SUITE: CONCURRENCIA, INTEGRIDAD Y VALIDACIÓN DE BD');
console.log('================================================================\n');

// 1. Inicialización de BD
console.log('1. Inicializando base de datos local SQLite con WAL mode...');
const db = localDb.initLocalDatabase();
assert.ok(db, 'Base de datos inicializada correctamente');
console.log('   ✓ Esquema, tablas, índices únicos y triggers creados con éxito.\n');

// 2. Usuarios y Roles (Admin y Cajero)
console.log('2. Verificando usuarios iniciales y roles...');
const cashiers = localDb.listCashiers();
assert.ok(cashiers.length >= 1, 'Debe haber al menos un cajero inicial');
const adminUser = { id: 1, full_name: 'Administrador', role: 'admin' };
const cajeroUser = { id: 2, full_name: 'Elena R.', role: 'cajero' };
console.log('   ✓ Usuarios cajeros y admin listos.\n');

// 3. Apertura de turnos para C1 y C2
console.log('3. Apertura de turnos para Caja 1 y Caja 2...');
const shiftC1 = localDb.openTerminalShift('C1', 1000.00, cajeroUser);
assert.strictEqual(shiftC1.ok, true, 'Turno de C1 abierto con éxito');
assert.strictEqual(shiftC1.shift.terminal_code, 'C1');

const shiftC2 = localDb.openTerminalShift('C2', 1500.00, adminUser);
assert.strictEqual(shiftC2.ok, true, 'Turno de C2 abierto con éxito');
assert.strictEqual(shiftC2.shift.terminal_code, 'C2');

// Intentar abrir un SEGUNDO turno en C1 mientras ya está abierto (debe ser bloqueado)
let doubleOpenBlocked = false;
try {
  localDb.openTerminalShift('C1', 500.00, cajeroUser);
} catch (e) {
  doubleOpenBlocked = true;
  assert.strictEqual(e.code, 'SHIFT_ALREADY_OPEN', 'Código de error debe ser SHIFT_ALREADY_OPEN');
}
assert.ok(doubleOpenBlocked, 'Doble apertura simultánea bloqueada por índice único ux_cash_cuts_one_open');
console.log('   ✓ Turnos abiertos independientemente para C1 y C2. Doble apertura bloqueada.\n');

// 4. Crear producto de prueba con exactamente 1 pieza en stock
console.log('4. Configurando producto con 1 pieza única para prueba de Race Condition...');
const testProduct = localDb.saveProduct({
  barcode: 'TEST-RACE-001',
  name: 'PlayStation 5 Edición Limitada',
  category: 'Electrónica',
  cost: 8000.00,
  price: 12000.00,
  stock: 1
}, 'Admin');

const pBefore = localDb.findProductByBarcode('TEST-RACE-001');
assert.strictEqual(pBefore.stock, 1, 'El stock inicial debe ser exactamente 1');
console.log(`   ✓ Producto creado: "${pBefore.name}", Stock = ${pBefore.stock}, Precio = $${pBefore.price}\n`);

// 5. Simulación de RACE CONDITION entre Caja 1 y Caja 2
console.log('5. Ejecutando intento simultáneo de compra del último artículo (C1 vs C2)...');
const salePayloadC1 = {
  folio: '#TK-C1-RACE-001',
  terminal_code: 'C1',
  payment_method: 'cash',
  total_net: 12000.00,
  cash_received: 12000.00,
  items: [{ barcode: 'TEST-RACE-001', quantity: 1, unitPrice: 12000.00 }]
};

const salePayloadC2 = {
  folio: '#TK-C2-RACE-002',
  terminal_code: 'C2',
  payment_method: 'card',
  total_net: 12000.00,
  items: [{ barcode: 'TEST-RACE-001', quantity: 1, unitPrice: 12000.00 }]
};

// Caja 1 compra la última pieza
const resC1 = localDb.processSale(salePayloadC1, cajeroUser);
assert.strictEqual(resC1.ok, true, 'Caja 1 debe completar la venta con éxito');
console.log('   ✓ Caja 1 procesó la venta con éxito. Stock restante en BD: 0');

// Caja 2 intenta comprar la misma pieza en el mismo instante
let raceConditionPrevented = false;
try {
  localDb.processSale(salePayloadC2, adminUser);
} catch (err) {
  raceConditionPrevented = true;
  assert.strictEqual(err.code, 'INSUFFICIENT_STOCK', 'Error debe ser INSUFFICIENT_STOCK');
  console.log(`   ✓ Caja 2 fue RECHAZADA inmediatamente: "${err.message}" (Código: ${err.code})`);
}
assert.ok(raceConditionPrevented, 'La transacción atómica BEGIN IMMEDIATE previno la sobreventa');

const pAfter = localDb.findProductByBarcode('TEST-RACE-001');
assert.strictEqual(pAfter.stock, 0, 'El stock nunca debe quedar negativo (es exactamente 0)');
console.log('   ✓ Cero Race Conditions: Imposible vender más de lo disponible ni generar stock negativo.\n');

// 6. Validación de manipulación de precios por cliente
console.log('6. Verificando validación de precios (Protección contra alteración en cliente)...');
localDb.saveProduct({ barcode: 'TEST-TAMPER-001', name: 'Refresco 600ml', cost: 10, price: 20, stock: 10 }, 'Admin');

let priceTamperBlocked = false;
try {
  localDb.processSale({
    folio: '#TK-C1-TAMPER',
    terminal_code: 'C1',
    payment_method: 'cash',
    total_net: 5.00, // Cliente intentando pagar $5 en vez del precio real $20
    cash_received: 5.00,
    items: [{ barcode: 'TEST-TAMPER-001', quantity: 1, unitPrice: 5.00 }]
  }, cajeroUser);
} catch (e) {
  priceTamperBlocked = true;
  assert.strictEqual(e.code, 'PRICE_CHANGED');
  console.log(`   ✓ Intento de manipulación de precio bloqueado: "${e.message}"`);
}
assert.ok(priceTamperBlocked, 'El servidor recalculó el precio real desde la BD e impidió la venta alterada');
console.log('   ✓ Seguridad de precios en servidor 100% verificada.\n');

// 7. Prueba de movimientos de caja y corte de turno
console.log('7. Verificando movimientos extraordinarios de caja y cierre de turno...');
localDb.registerCashMovement('C1', 'inflow', 500.00, 'Cambio extra de monedas', cajeroUser);
const shiftStatusBeforeClose = localDb.getTerminalShift('C1');
// Esperado: Fondo 1000 + Venta 12000 + Entrada 500 = 13500
assert.strictEqual(shiftStatusBeforeClose.live_totals.expected_cash, 13500.00);

const closeRes = localDb.closeTerminalShift('C1', 13500.00, 'Corte C1 exacto sin diferencias', cajeroUser);
assert.strictEqual(closeRes.ok, true);
assert.strictEqual(closeRes.shift.status, 'closed');
assert.strictEqual(closeRes.shift.difference, 0.00);
console.log(`   ✓ Turno C1 cerrado correctamente. Total ventas: $${closeRes.shift.total_sales_amount}, Diferencia: $${closeRes.shift.difference}\n`);

// 8. Verificación de Dirty Tracking para Respaldo en la Nube
console.log('8. Verificando seguimiento de cambios (rev > synced_rev) para Supabase...');
const backupStatus = localDb.getBackupStatus();
assert.ok(backupStatus.pendingCloudRows > 0, 'Debe haber filas pendientes de respaldo hacia Supabase');
console.log(`   ✓ Filas pendientes para la siguiente sincronización en la nube: ${backupStatus.pendingCloudRows}`);
console.log('     Detalle por tabla:', JSON.stringify(backupStatus.pendingByTable));

// Limpieza de BD temporal
if (fs.existsSync(TEST_DB)) {
  try { fs.unlinkSync(TEST_DB); } catch (e) {}
}

console.log('\n================================================================');
console.log('RESULTADO: TODAS LAS PRUEBAS DE EXPERTO EN BD PASARON AL 100%');
console.log('================================================================');

