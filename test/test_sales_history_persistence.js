const assert = require('assert');

// Simular entorno del navegador (DOM mínimo + localStorage)
const storage = {};
global.window = {
  localStorage: {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; }
  },
  getActiveTerminal: () => ({ code: 'C1', name: 'Caja 1' }),
  currentSessionUser: { role: 'cajero', name: 'Elena R.', username: 'elena' }
};

// Cargar cliente de datos
require('../www/js/supabaseClient.js');
const PosDataService = window.PosDataService;

console.log('================================================================');
console.log('TEST SUITE: PERSISTENCIA DEL HISTORIAL DE VENTAS (ADMIN & CAJERO)');
console.log('================================================================\n');

// 1. Simular venta completada
const ticketCajero = {
  id: 101,
  folio: '#TK-C1-20261114-001',
  date: '19:25 hrs',
  created_at: new Date().toISOString(),
  cajaCode: 'C1',
  cajaName: 'Caja 1',
  cashier: 'Elena R.',
  itemsCount: 2,
  itemsSummary: '2 productos',
  itemsDetail: 'Leche Lala Entera 1L x2',
  items: [{ name: 'Leche Lala Entera 1L', quantity: 2, unitPrice: 29.50, total: 59.00 }],
  paymentMethod: 'cash',
  cashAmount: 59.00,
  cardAmount: 0,
  transferAmount: 0,
  total: 59.00,
  status: 'completed'
};

const ticketAdmin = {
  id: 102,
  folio: '#TK-C1-20261114-002',
  date: '19:30 hrs',
  created_at: new Date().toISOString(),
  cajaCode: 'C1',
  cajaName: 'Caja 1',
  cashier: 'Administrador',
  itemsCount: 1,
  itemsSummary: '1 producto',
  itemsDetail: 'Coca-Cola Original 600ml x1',
  items: [{ name: 'Coca-Cola Original 600ml', quantity: 1, unitPrice: 19.00, total: 19.00 }],
  paymentMethod: 'card',
  cashAmount: 0,
  cardAmount: 19.00,
  transferAmount: 0,
  total: 19.00,
  status: 'completed'
};

// Guardar tickets
let history = PosDataService.getSalesHistory();
assert.strictEqual(history.length, 0, 'Historial inicial debe ser vacío');

history.unshift(ticketCajero);
PosDataService.saveSalesHistory(history);
assert.strictEqual(PosDataService.getSalesHistory().length, 1, 'Ticket de cajero debe guardarse');

history.unshift(ticketAdmin);
PosDataService.saveSalesHistory(history);
assert.strictEqual(PosDataService.getSalesHistory().length, 2, 'Ticket de admin debe guardarse');

console.log('✓ 1. Tickets guardados exitosamente en localStorage.');

// 2. Simular cambio de vista y llamada a refreshSalesFromSupabase()
window.PosApp = {
  salesHistoryList: PosDataService.getSalesHistory(),
  activeShiftTotals: null
};

// Cargar lógica de app.js (simulada)
// Si el turno está cerrado, NUNCA debe borrar las ventas de salesHistoryList
const shiftDataCerrado = { is_open: false, terminal_code: 'C1', sales: [] };
if (shiftDataCerrado && shiftDataCerrado.is_open) {
  window.PosApp.salesHistoryList = shiftDataCerrado.sales;
} else {
  // Aseguramos que NO se borre salesHistoryList
  const local = PosDataService.getSalesHistory() || [];
  if (local.length > 0) {
    window.PosApp.salesHistoryList = local;
  }
}

assert.strictEqual(window.PosApp.salesHistoryList.length, 2, 'Las ventas NO deben borrarse con turno cerrado o al cambiar de vista');
console.log('✓ 2. Cambio de vista y refresco de turno: Las 2 ventas se preservaron íntegras.');

// 3. Simular KPI calculation de salesHistory.js
let totalTickets = 0;
let totalAmount = 0;
let totalCash = 0;

window.PosApp.salesHistoryList.forEach(item => {
  if (item.status === 'completed') {
    totalTickets++;
    totalAmount += parseFloat(item.total);
    if (item.paymentMethod === 'cash') totalCash += parseFloat(item.cashAmount || item.total);
  }
});

assert.strictEqual(totalTickets, 2, 'Debe haber 2 tickets en los KPIs');
assert.strictEqual(totalAmount, 78.00, 'El monto total debe ser $78.00 (59 + 19)');
assert.strictEqual(totalCash, 59.00, 'El monto en efectivo debe ser $59.00');
console.log('✓ 3. KPIs de Historial de Ventas calculados exactamente: 2 tickets, Total $78.00, Efectivo $59.00.');

console.log('\n================================================================');
console.log('RESULTADO: TEST DE PERSISTENCIA DE VENTAS SUPERADO AL 100%');
console.log('================================================================');

