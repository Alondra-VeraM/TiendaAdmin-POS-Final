const assert = require('assert');
const fs = require('fs');

console.log('================================================================');
console.log('TEST: IMPACTO DE MOVIMIENTOS EN EFECTIVO SOBRE EFECTIVO ESPERADO');
console.log('================================================================\n');

// Mock browser environment
const mockLocalStorage = {};
global.localStorage = {
  getItem: (k) => mockLocalStorage[k] || null,
  setItem: (k, v) => { mockLocalStorage[k] = String(v); },
  removeItem: (k) => { delete mockLocalStorage[k]; }
};

const domElements = {};
function createMockElement(id, tag = 'div') {
  return {
    id,
    tagName: tag.toUpperCase(),
    value: '',
    checked: false,
    textContent: '',
    innerHTML: '',
    style: {},
    children: [],
    appendChild(child) { this.children.push(child); },
    focus() {},
    reset() { this.value = ''; },
    addEventListener(evt, fn) { this['on' + evt] = fn; }
  };
}

const elementIds = [
  'modalCashMovement', 'formCashMovement', 'movTypeIncome', 'movTypeExpense',
  'movAmount', 'movCategory', 'movCategoryCustom', 'movConcept',
  'movPaymentMethod', 'movNotes', 'btnSaveCashMovement', 'btnCancelMovementModal',
  'btnCloseMovementModal', 'btnNewMovement', 'modalMovementTitle',
  'cutExpectedCash', 'cutMoveEntriesAmount', 'cutMoveEntriesCount',
  'cutMoveExitsAmount', 'cutMoveExitsCount', 'inputEfectivoContado',
  'cutInitialFund', 'cutShiftDuration', 'cutCashierName', 'badgeShiftStatus'
];

elementIds.forEach(id => {
  domElements[id] = createMockElement(id);
});

global.document = {
  getElementById: (id) => domElements[id] || null,
  createElement: (tag) => ({ tagName: tag.toUpperCase(), value: '', textContent: '' }),
  addEventListener: () => {},
  querySelectorAll: () => []
};

global.window = {
  localStorage: global.localStorage,
  document: global.document,
  showModal: (title, msg) => { console.log(`  [UI Modal] ${title}: ${msg.split('\n')[0]}`); },
  getActiveTerminal: () => ({ code: 'C1', name: 'Caja 1' }),
  renderCashMovements: () => {},
  renderCashCut: () => {}
};

// Cargar cashMovements.js
const cashMovCode = fs.readFileSync('www/js/app/cashMovements.js', 'utf8');
eval(cashMovCode);

// Simular turno abierto en Caja 1 con fondo inicial $1,000.00
const shiftStart = new Date();
const initialFund = 1000.00;
const shiftData = {
  is_open: true,
  terminal_code: 'C1',
  shift: {
    id: 1,
    terminal_code: 'C1',
    initial_fund: initialFund,
    opened_at: shiftStart.toISOString(),
    cashier_name: 'Administrador'
  },
  live_totals: {
    total_sales_count: 0,
    total_sales_amount: 0,
    cash_sales: 0,
    expected_cash: initialFund
  }
};
localStorage.setItem('pos_shift_C1', JSON.stringify(shiftData));

console.log('1. Turno iniciado con Fondo Inicial = $1,000.00');
let summary = window.getShiftCashMovementsSummary(shiftStart, 'C1');
assert.strictEqual(summary.cashIncomesTotal, 0);
assert.strictEqual(summary.cashExpensesTotal, 0);
assert.strictEqual(summary.netCashImpact, 0);
console.log('   ✓ Impacto inicial de movimientos: $0.00\n');

// 2. Registrar INGRESO EN EFECTIVO de $500.00
console.log('2. Registrando INGRESO en EFECTIVO por $500.00 (Fondo extra)...');
domElements['movTypeIncome'].checked = true;
domElements['movTypeExpense'].checked = false;
domElements['movAmount'].value = '500.00';
domElements['movConcept'].value = 'Fondo extra de caja';
domElements['movCategory'].value = 'Aportaciones del propietario';
domElements['movPaymentMethod'].value = 'cash';

window.saveCashMovement().then(async () => {
  summary = window.getShiftCashMovementsSummary(shiftStart, 'C1');
  assert.strictEqual(summary.cashIncomesTotal, 500.00, 'Ingreso en efectivo debe ser $500');
  assert.strictEqual(summary.netCashImpact, 500.00, 'Impacto neto en efectivo debe ser +$500');

  const cachedShift = JSON.parse(localStorage.getItem('pos_shift_C1'));
  assert.strictEqual(cachedShift.shift.live_totals.expected_cash, 1500.00, 'expected_cash debe subir a $1500');
  console.log('   ✓ Efectivo esperado actualizado: $1,000.00 + $500.00 = $' + cachedShift.shift.live_totals.expected_cash.toFixed(2) + '\n');

  // 3. Registrar INGRESO POR TRANSFERENCIA de $200.00
  console.log('3. Registrando INGRESO por TRANSFERENCIA por $200.00...');
  domElements['movTypeIncome'].checked = true;
  domElements['movTypeExpense'].checked = false;
  domElements['movAmount'].value = '200.00';
  domElements['movConcept'].value = 'Pago banco SPEI';
  domElements['movCategory'].value = 'Otros ingresos';
  domElements['movPaymentMethod'].value = 'transfer';

  await window.saveCashMovement();
  summary = window.getShiftCashMovementsSummary(shiftStart, 'C1');
  assert.strictEqual(summary.totalIncomesAmount, 700.00, 'Total ingresos general debe ser $700 (500 + 200)');
  assert.strictEqual(summary.cashIncomesTotal, 500.00, 'Ingreso en efectivo se mantiene en $500');
  assert.strictEqual(summary.nonCashIncomesTotal, 200.00, 'Ingreso no en efectivo debe ser $200');

  const cachedShift2 = JSON.parse(localStorage.getItem('pos_shift_C1'));
  assert.strictEqual(cachedShift2.shift.live_totals.expected_cash, 1500.00, 'expected_cash NO debe cambiar con transferencia, se mantiene en $1500');
  console.log('   ✓ Verificación exitosa: La transferencia NO afectó el efectivo esperado en caja ($1,500.00)\n');

  // 4. Registrar EGRESO EN EFECTIVO de $150.00
  console.log('4. Registrando EGRESO en EFECTIVO por $150.00 (Insumos de papelería)...');
  domElements['movTypeIncome'].checked = false;
  domElements['movTypeExpense'].checked = true;
  domElements['movAmount'].value = '150.00';
  domElements['movConcept'].value = 'Compra de rollos térmicos';
  domElements['movCategory'].value = 'Compra de insumos';
  domElements['movPaymentMethod'].value = 'cash';

  await window.saveCashMovement();
  summary = window.getShiftCashMovementsSummary(shiftStart, 'C1');
  assert.strictEqual(summary.cashExpensesTotal, 150.00, 'Egreso en efectivo debe ser $150');
  assert.strictEqual(summary.netCashImpact, 350.00, 'Impacto neto en efectivo debe ser +$350 (500 - 150)');

  const cachedShift3 = JSON.parse(localStorage.getItem('pos_shift_C1'));
  assert.strictEqual(cachedShift3.shift.live_totals.expected_cash, 1350.00, 'expected_cash debe restar los $150 y quedar en $1350');
  console.log('   ✓ Efectivo esperado actualizado: $1,500.00 - $150.00 = $' + cachedShift3.shift.live_totals.expected_cash.toFixed(2) + '\n');

  // 5. Registrar EGRESO POR TRANSFERENCIA de $300.00
  console.log('5. Registrando EGRESO por TRANSFERENCIA por $300.00 (Pago de internet Totalplay)...');
  domElements['movTypeIncome'].checked = false;
  domElements['movTypeExpense'].checked = true;
  domElements['movAmount'].value = '300.00';
  domElements['movConcept'].value = 'Pago Totalplay';
  domElements['movCategory'].value = 'Pago de servicios (luz, agua, internet)';
  domElements['movPaymentMethod'].value = 'transfer';

  await window.saveCashMovement();
  summary = window.getShiftCashMovementsSummary(shiftStart, 'C1');
  assert.strictEqual(summary.totalExpensesAmount, 450.00, 'Total egresos general debe ser $450 (150 + 300)');
  assert.strictEqual(summary.cashExpensesTotal, 150.00, 'Egreso en efectivo físico debe mantenerse en $150');
  assert.strictEqual(summary.nonCashExpensesTotal, 300.00, 'Egreso no en efectivo debe ser $300');

  const cachedShift4 = JSON.parse(localStorage.getItem('pos_shift_C1'));
  assert.strictEqual(cachedShift4.shift.live_totals.expected_cash, 1350.00, 'expected_cash NO debe restar la transferencia bancaria, se mantiene en $1350');
  console.log('   ✓ Verificación exitosa: El egreso por transferencia NO afectó el efectivo esperado en caja ($1,350.00)\n');

  console.log('================================================================');
  console.log('RESUMEN FINAL:');
  console.log('  Fondo inicial:                $1,000.00');
  console.log('  Ingresos en efectivo:       + $  500.00');
  console.log('  Egresos en efectivo:        - $  150.00');
  console.log('  ---------------------------------------');
  console.log('  Total esperado en caja:       $1,350.00');
  console.log('================================================================');
  console.log('✓ TODAS LAS COMPROBACIONES PASARON CON ÉXITO (100%)\n');
});
