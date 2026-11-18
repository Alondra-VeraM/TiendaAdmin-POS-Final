const assert = require('assert');
const { buildEscPosTicket, getCashierDisplayName } = require('../electron/modules/printer.js');

console.log('--- Test 1: getCashierDisplayName unit tests ---');
assert.strictEqual(getCashierDisplayName('Elena R.', 'cajero'), 'Elena R.');
assert.strictEqual(getCashierDisplayName('Juan Pérez', null), 'Juan Pérez');
assert.strictEqual(getCashierDisplayName('Administrador', 'admin'), null);
assert.strictEqual(getCashierDisplayName('admin', null), null);
assert.strictEqual(getCashierDisplayName('administrador', null), null);
assert.strictEqual(getCashierDisplayName('Gerente', null), null);
assert.strictEqual(getCashierDisplayName('Carlos M.', 'admin'), null);
assert.strictEqual(getCashierDisplayName('', 'cajero'), null);
assert.strictEqual(getCashierDisplayName(null, null), null);
assert.strictEqual(getCashierDisplayName(undefined, undefined), null);
assert.strictEqual(getCashierDisplayName('   ', null), null);
console.log('✓ getCashierDisplayName tests passed!');

console.log('--- Test 2: buildEscPosTicket with cashier ---');
const ticketWithCashier = {
  storeName: 'Mi Tiendita',
  caja: 'Caja 1',
  cashier: 'Elena R.',
  role: 'cajero',
  date: '15/11/2026 10:00',
  items: [{ name: 'Refresco', price: 20, quantity: 1, total: 20 }],
  total: 20
};
const bufWithCashier = buildEscPosTicket(ticketWithCashier).toString('latin1');
assert(bufWithCashier.includes('Caja: Caja 1'), 'Must include Caja: Caja 1');
assert(bufWithCashier.includes('Cajero: Elena R.'), 'Must include Cajero: Elena R.');
const cajaIdx1 = bufWithCashier.indexOf('Caja: Caja 1');
const cajeroIdx1 = bufWithCashier.indexOf('Cajero: Elena R.');
assert(cajeroIdx1 > cajaIdx1, 'Cajero must be below Caja');
console.log('✓ Ticket with cashier verified!');

console.log('--- Test 3: buildEscPosTicket with administrator ---');
const ticketWithAdmin = {
  storeName: 'Mi Tiendita',
  caja: 'Caja 1',
  cashier: 'Administrador',
  role: 'admin',
  date: '15/11/2026 10:00',
  items: [{ name: 'Refresco', price: 20, quantity: 1, total: 20 }],
  total: 20
};
const bufWithAdmin = buildEscPosTicket(ticketWithAdmin).toString('latin1');
assert(bufWithAdmin.includes('Caja: Caja 1'), 'Must include Caja: Caja 1');
assert(!bufWithAdmin.includes('Cajero:'), 'Must NOT include Cajero when sale was made by admin');
console.log('✓ Ticket with admin verified (Cajero line omitted)!');

console.log('--- Test 4: buildEscPosTicket with empty cashier ---');
const ticketNoCashier = {
  storeName: 'Mi Tiendita',
  caja: 'Caja 2',
  cashier: '',
  date: '15/11/2026 10:00',
  items: [{ name: 'Refresco', price: 20, quantity: 1, total: 20 }],
  total: 20
};
const bufNoCashier = buildEscPosTicket(ticketNoCashier).toString('latin1');
assert(bufNoCashier.includes('Caja: Caja 2'), 'Must include Caja: Caja 2');
assert(!bufNoCashier.includes('Cajero:'), 'Must NOT include Cajero when cashier is empty');
console.log('✓ Ticket without cashier verified (Cajero line omitted)!');

console.log('\n========================================');
console.log('ALL TICKET CASHIER LAYOUT TESTS PASSED 100%');
console.log('========================================');
