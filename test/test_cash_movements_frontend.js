const assert = require('assert');
const fs = require('fs');

console.log('Testing frontend cash movements logic...');

// Mock window and document environment
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
  'btnCloseMovementModal', 'btnNewMovement', 'modalMovementTitle'
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
  showModal: (title, msg) => { console.log(`[UI Modal] ${title}: ${msg}`); },
  getActiveTerminal: () => ({ code: 'C1', name: 'Caja 1' }),
  renderCashMovements: () => { console.log('renderCashMovements called'); },
  renderCashCut: () => { console.log('renderCashCut called'); }
};

// Evaluate cashMovements.js
const code = fs.readFileSync('www/js/app/cashMovements.js', 'utf8');
eval(code);

assert(typeof window.saveCashMovement === 'function', 'saveCashMovement must be a function');
assert(typeof window.openNewMovementModal === 'function', 'openNewMovementModal must be a function');
assert(typeof window.CashMovementsService === 'object', 'CashMovementsService must exist');

// Test 1: Open Income Modal
window.openNewMovementModal('income');
assert.strictEqual(domElements['modalCashMovement'].style.display, 'flex');
assert.strictEqual(domElements['movTypeIncome'].checked, true);
assert(domElements['movCategory'].children.length > 0, 'Categories must be populated');

// Test 2: Validation check (empty inputs)
let alerted = false;
window.showModal = (title) => { alerted = true; };
domElements['movAmount'].value = '';
window.saveCashMovement();
assert.strictEqual(alerted, true, 'Must alert on invalid amount');

// Test 3: Save valid income movement
domElements['movAmount'].value = '350.50';
domElements['movConcept'].value = 'Aportación socios';
domElements['movCategory'].value = 'Aportaciones del propietario';
domElements['movPaymentMethod'].value = 'cash';

window.saveCashMovement().then(() => {
  const all = window.CashMovementsService.getAll();
  assert(all.length > 0, 'Must have at least 1 movement in memory');
  assert.strictEqual(all[0].amount, 350.50, 'Amount must match');
  assert.strictEqual(all[0].type, 'income', 'Type must be income');
  assert.strictEqual(all[0].concept, 'Aportación socios', 'Concept must match');
  assert.strictEqual(domElements['modalCashMovement'].style.display, 'none', 'Modal must be closed on success');

  // Verify shift summary
  const summary = window.getShiftCashMovementsSummary();
  assert.strictEqual(summary.totalIncomesAmount, 350.50);
  assert.strictEqual(summary.cashIncomesTotal, 350.50);
  console.log('✓ Test 1 & 2 passed: Income movement saved and calculated successfully.');

  // Test 4: Save valid expense movement
  window.openNewMovementModal('expense');
  assert.strictEqual(domElements['movTypeExpense'].checked, true);
  domElements['movAmount'].value = '120.00';
  domElements['movConcept'].value = 'Compra de bolsas';
  domElements['movPaymentMethod'].value = 'cash';

  window.saveCashMovement().then(() => {
    const allAfter = window.CashMovementsService.getAll();
    assert.strictEqual(allAfter.length, 2, 'Must now have 2 movements');
    assert.strictEqual(allAfter[0].type, 'expense');
    assert.strictEqual(allAfter[0].amount, 120.00);

    const updatedSummary = window.getShiftCashMovementsSummary();
    assert.strictEqual(updatedSummary.totalExpensesAmount, 120.00);
    assert.strictEqual(updatedSummary.cashExpensesTotal, 120.00);
    assert.strictEqual(updatedSummary.netCashImpact, 230.50); // 350.50 - 120.00
    console.log('✓ Test 3 & 4 passed: Expense movement saved and net cash impact calculated successfully.');
    console.log('\nALL FRONTEND MOVEMENT TESTS PASSED 100%!');
  });
});
