/**
 * Test Suite para el Módulo de Ingresos y Egresos e integración con Corte de Caja
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const TEST_DB = path.join(__dirname, 'test_cash_movements.sqlite');
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
process.env.LOCAL_DB_FILE = TEST_DB;

const localDb = require('../database/localDb');

console.log('================================================================');
console.log('TEST SUITE: INGRESOS Y EGRESOS & CORTE DE CAJA');
console.log('================================================================\n');

const db = localDb.initLocalDatabase();

// 1. Limpiar estado previo para asegurar aislamiento de pruebas
db.prepare("DELETE FROM cash_movements WHERE terminal_code IN ('C1', 'C2')").run();
db.prepare("DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE terminal_code IN ('C1', 'C2'))").run();
db.prepare("DELETE FROM sales WHERE terminal_code IN ('C1', 'C2')").run();
db.prepare("DELETE FROM cash_cuts WHERE terminal_code IN ('C1', 'C2')").run();

console.log('1. Abriendo turno en Caja 1 con fondo inicial de $1,000.00...');
const cashier = { id: 1, full_name: 'Cajero Test' };
const openResult = localDb.openTerminalShift('C1', 1000.00, cashier);
assert.strictEqual(openResult.ok, true, 'Turno C1 debe abrir exitosamente');
const cutId = openResult.shift.id;
console.log(`   ✓ Turno abierto con id = ${cutId}, Fondo inicial = $1,000.00\n`);

// 2. Registrar Ingreso adicional en EFECTIVO ($300.00)
console.log('2. Registrando Ingreso en EFECTIVO por $300.00 (Fondo extra)...');
const incomeCash = localDb.saveCashMovement({
  terminal_code: 'C1',
  movement_type: 'inflow',
  concept: 'Fondo extra aportado por dueño',
  category: 'Aportaciones del propietario',
  amount: 300.00,
  payment_method: 'cash'
}, cashier);
assert.strictEqual(incomeCash.ok, true, 'Ingreso en efectivo debe guardarse');
assert.strictEqual(incomeCash.movement.cash_cut_id, cutId, 'Debe asociarse automáticamente con el turno abierto');
console.log(`   ✓ Ingreso en efectivo guardado id = ${incomeCash.id}\n`);

// Verificar totales del turno
let shift = localDb.getTerminalShift('C1');
assert.strictEqual(shift.live_totals.cash_inflows, 300.00, 'cash_inflows debe ser $300.00');
assert.strictEqual(shift.live_totals.expected_cash, 1300.00, 'expected_cash debe ser $1,300.00 (1000 + 300)');
console.log(`   ✓ Efectivo esperado actualizado: $${shift.live_totals.expected_cash.toFixed(2)} (1000 + 300)\n`);

// 3. Registrar Egreso en EFECTIVO ($150.00)
console.log('3. Registrando Egreso en EFECTIVO por $150.00 (Compra de rollos térmicos)...');
const expenseCash = localDb.saveCashMovement({
  terminal_code: 'C1',
  movement_type: 'outflow',
  concept: 'Rollos térmicos',
  category: 'Compra de insumos',
  amount: 150.00,
  payment_method: 'cash'
}, cashier);
assert.strictEqual(expenseCash.ok, true, 'Egreso en efectivo debe guardarse');

shift = localDb.getTerminalShift('C1');
assert.strictEqual(shift.live_totals.cash_outflows, 150.00, 'cash_outflows debe ser $150.00');
assert.strictEqual(shift.live_totals.expected_cash, 1150.00, 'expected_cash debe ser $1,150.00 (1300 - 150)');
console.log(`   ✓ Egreso descontado correctamente: Efectivo esperado = $${shift.live_totals.expected_cash.toFixed(2)} (1300 - 150)\n`);

// 4. Registrar Egreso por TRANSFERENCIA SPEI ($499.00)
console.log('4. Registrando Egreso por TRANSFERENCIA SPEI por $499.00 (Pago de internet)...');
const expenseTransfer = localDb.saveCashMovement({
  terminal_code: 'C1',
  movement_type: 'outflow',
  concept: 'Totalplay Internet',
  category: 'Pago de servicios (luz, agua, internet)',
  amount: 499.00,
  payment_method: 'transfer'
}, cashier);
assert.strictEqual(expenseTransfer.ok, true, 'Egreso por transferencia debe guardarse');

shift = localDb.getTerminalShift('C1');
assert.strictEqual(shift.live_totals.cash_outflows, 150.00, 'cash_outflows debe mantenerse en $150.00 (transferencia NO descuenta caja física)');
assert.strictEqual(shift.live_totals.total_outflows, 649.00, 'total_outflows debe ser $649.00 (150 + 499)');
assert.strictEqual(shift.live_totals.expected_cash, 1150.00, 'expected_cash NO debe descontar la transferencia: sigue en $1,150.00');
console.log(`   ✓ Verificación exitosa: La transferencia NO descontó efectivo en caja física (Esperado: $${shift.live_totals.expected_cash.toFixed(2)})\n`);

// 5. Registrar Ingreso por TRANSFERENCIA ($200.00)
console.log('5. Registrando Ingreso por TRANSFERENCIA por $200.00...');
const incomeTransfer = localDb.saveCashMovement({
  terminal_code: 'C1',
  movement_type: 'inflow',
  concept: 'Transferencia extraordinaria',
  category: 'Otros ingresos',
  amount: 200.00,
  payment_method: 'transfer'
}, cashier);
assert.strictEqual(incomeTransfer.ok, true);

shift = localDb.getTerminalShift('C1');
assert.strictEqual(shift.live_totals.cash_inflows, 300.00, 'cash_inflows en caja física se mantiene en $300.00');
assert.strictEqual(shift.live_totals.total_inflows, 500.00, 'total_inflows es $500.00 (300 + 200)');
assert.strictEqual(shift.live_totals.expected_cash, 1150.00, 'expected_cash se mantiene en $1,150.00');
console.log(`   ✓ Verificación exitosa: Ingreso por transferencia no infla caja física (Esperado: $${shift.live_totals.expected_cash.toFixed(2)})\n`);

// 6. Validar que un Egreso en efectivo mayor al saldo en caja sea RECHAZADO
console.log('6. Intentando Egreso en efectivo de $2,000.00 (Mayor a lo disponible en caja: $1,150.00)...');
let blocked = false;
try {
  localDb.saveCashMovement({
    terminal_code: 'C1',
    movement_type: 'outflow',
    concept: 'Retiro no permitido',
    category: 'Otros',
    amount: 2000.00,
    payment_method: 'cash'
  }, cashier);
} catch (err) {
  blocked = true;
  assert.strictEqual(err.code, 'INSUFFICIENT_CASH', 'Debe arrojar INSUFFICIENT_CASH');
  console.log(`   ✓ Rechazo correcto: "${err.message}" (Código: ${err.code})\n`);
}
assert.strictEqual(blocked, true, 'El retiro excesivo debe ser bloqueado');

// 7. Consultar lista de movimientos desde la BD
console.log('7. Consultando lista de movimientos con getCashMovements()...');
const list = localDb.getCashMovements({ terminal: 'C1' });
assert.strictEqual(list.length, 4, 'Deben existir 4 movimientos guardados');
console.log(`   ✓ Consultados ${list.length} movimientos de la base de datos real\n`);

// 8. Cerrar turno y verificar totales guardados en cash_cuts
console.log('8. Cerrando turno de Caja 1...');
const closeResult = localDb.closeTerminalShift('C1', 1150.00, 'Cierre de prueba', cashier);
assert.strictEqual(closeResult.ok, true, 'El turno debe cerrar correctamente');
const closedShift = closeResult.shift;
assert.strictEqual(closedShift.status, 'closed', 'El estado del corte debe ser closed');
assert.strictEqual(closedShift.cash_inflows, 300.00, 'cash_inflows guardado en corte = 300.00');
assert.strictEqual(closedShift.cash_outflows, 150.00, 'cash_outflows guardado en corte = 150.00');
assert.strictEqual(closedShift.expected_cash, 1150.00, 'expected_cash guardado en corte = 1150.00');
assert.strictEqual(closedShift.difference, 0.00, 'Diferencia debe ser 0.00');
console.log(`   ✓ Turno cerrado y archivado en BD con esperados e ingresos/egresos exactos.\n`);

// 9. Eliminar un movimiento y verificar consistencia
console.log('9. Eliminando movimiento por id...');
const delResult = localDb.deleteCashMovement(incomeTransfer.id);
assert.strictEqual(delResult.ok, true, 'Debe eliminar el movimiento');
const listAfterDel = localDb.getCashMovements({ terminal: 'C1' });
assert.strictEqual(listAfterDel.length, 3, 'Deben quedar 3 movimientos tras la eliminación');
console.log(`   ✓ Movimiento eliminado correctamente. Registros restantes: ${listAfterDel.length}\n`);

db.close();
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

console.log('================================================================');
console.log('RESULTADO: TODAS LAS PRUEBAS DE INGRESOS Y EGRESOS PASARON (100%)');
console.log('================================================================');
