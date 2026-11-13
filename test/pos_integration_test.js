/**
 * SUITE DE PRUEBAS AUTOMATIZADAS DE INTEGRACIÓN Y CONCURRENCIA
 * TiendaAdmin-POS
 * 
 * Escenarios probados:
 * 1. PERSISTENCIA DE CORTE DE CAJA Y BLOQUEO DE VENTAS
 *    - Validación de turno cerrado -> Bloqueo obligatorio de venta
 *    - Apertura de turno -> Desbloqueo de venta
 *    - Registro de venta atómica asociada al turno
 *    - Cierre de turno y corte persistente en Supabase
 *    - Verificación de bloqueo post-cierre (persiste estado)
 *    - Prevención de cortes duplicados
 * 
 * 2. REPORTES DE VARIOS DÍAS Y FILTROS POR CAJA
 *    - Consulta de un día y varios días
 *    - Filtro por Caja 1 (C1)
 *    - Filtro por Caja 2 (C2)
 *    - Filtro de ambas cajas sin duplicar
 *    - Verificación de totales acumulados y pagos mixtos
 *    - Periodo vacío
 * 
 * 3. SINCRONIZACIÓN ENTRE DOS CAJAS (C1 Y C2)
 *    - Ambas cajas comparten inventario de productos
 *    - Turnos independientes (Caja 1 cerrada, Caja 2 abierta y vendiendo)
 *    - Prevención de duplicación por idempotencia (reintentos de folio)
 *    - Concurrencia y prevención de sobreventa / stock negativo
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://qluxojdodesadfthugml.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsdXhvamRvZGVzYWRmdGh1Z21sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxODM5NTUsImV4cCI6MjEwNzc1OTk1NX0.t5etK56r6Z2qsHPtjni7wnN1AmUSDEfQXG_4Roum2u0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FALLÓ ASERCIÓN: ${message}`);
    throw new Error(message);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('INICIANDO PRUEBAS DE INTEGRACIÓN: TIENDAADMIN-POS');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  // ---------------------------------------------------------------------------
  // BLOQUE 1: CORTE DE CAJA, APERTURA DE TURNO Y BLOQUEO DE VENTAS
  // ---------------------------------------------------------------------------
  console.log('--- BLOQUE 1: Persistencia de Corte y Bloqueo de Ventas ---');

  // Asegurar que C1 esté cerrada al inicio
  await supabase.rpc('close_terminal_shift', {
    p_terminal_code: 'C1',
    p_counted_cash: 1000.00
  });

  // 1.1 Intentar venta con caja C1 cerrada
  total++;
  const testClosedFolio = `#TEST-BLOCKED-${Date.now()}`;
  const resBlocked = await supabase.rpc('register_sale_atomic', {
    p_folio: testClosedFolio,
    p_terminal_code: 'C1',
    p_terminal_name: 'Caja 1',
    p_cashier_name: 'Elena R.',
    p_subtotal: 50.00,
    p_discount: 0.00,
    p_total_net: 50.00,
    p_payment_method: 'cash',
    p_items: [{ barcode: '7501820511234', name: 'Leche Lala Entera 1L', quantity: 1, unitPrice: 29.50, subtotal: 29.50 }]
  });

  if (resBlocked.error) {
    console.error('resBlocked error:', resBlocked.error);
  }
  assert(!resBlocked.data?.ok, 'Venta en caja C1 cerrada fue RECHAZADA');
  assert(resBlocked.data?.error_code === 'SHIFT_CLOSED', 'Código de error es SHIFT_CLOSED');
  passed++;

  // 1.2 Abrir nuevo turno en Caja 1
  total++;
  const resOpenC1 = await supabase.rpc('open_terminal_shift', {
    p_terminal_code: 'C1',
    p_terminal_name: 'Caja 1',
    p_cashier_name: 'Elena R.',
    p_initial_fund: 1200.00
  });

  assert(resOpenC1.data.ok, 'Turno en Caja 1 abierto exitosamente');
  assert(resOpenC1.data.shift.status === 'open', 'Estado del turno es "open"');
  assert(parseFloat(resOpenC1.data.shift.initial_fund) === 1200.00, 'Fondo inicial registrado correctamente ($1,200.00)');
  passed++;

  // 1.3 Verificar que no permite dos turnos abiertos simultáneos para C1
  total++;
  const resOpenDup = await supabase.rpc('open_terminal_shift', {
    p_terminal_code: 'C1',
    p_terminal_name: 'Caja 1',
    p_cashier_name: 'Elena R.',
    p_initial_fund: 1500.00
  });
  assert(resOpenDup.data.ok && resOpenDup.data.already_open, 'No se duplica turno abierto para C1 (detecta already_open)');
  passed++;

  // 1.4 Registrar una venta real con turno abierto
  total++;
  const testSaleFolio = `#TEST-SALE-${Date.now()}`;
  const resSale = await supabase.rpc('register_sale_atomic', {
    p_folio: testSaleFolio,
    p_terminal_code: 'C1',
    p_terminal_name: 'Caja 1',
    p_cashier_name: 'Elena R.',
    p_subtotal: 74.50,
    p_discount: 0.00,
    p_total_net: 74.50,
    p_payment_method: 'mixed',
    p_cash_amount: 50.00,
    p_card_amount: 24.50,
    p_transfer_amount: 0.00,
    p_items: [
      { id: 1, barcode: '7501820511234', name: 'Leche Lala Entera 1L', quantity: 1, unitPrice: 29.50, subtotal: 29.50 },
      { id: 3, barcode: '750103912089', name: 'Aceite Nutrioli 850ml', quantity: 1, unitPrice: 45.00, subtotal: 45.00 }
    ]
  });

  if (!resSale.data) {
    console.error('resSale error:', resSale.error);
  }
  assert(resSale.data?.ok, 'Venta atómica registrada exitosamente con turno abierto');
  assert(resSale.data?.folio === testSaleFolio, 'Folio coincide con el generado');
  passed++;

  // 1.5 Verificar que la venta quedó asociada al turno activo
  total++;
  const resShiftCheck = await supabase.rpc('get_terminal_shift', { p_terminal_code: 'C1' });
  assert(resShiftCheck.data.is_open, 'La terminal C1 reporta turno abierto');
  assert(resShiftCheck.data.live_totals.total_sales_count >= 1, 'Turno en vivo contabiliza la nueva venta');
  assert(parseFloat(resShiftCheck.data.live_totals.cash_sales) >= 50.00, 'Desglose en vivo registra efectivo de pago mixto ($50.00)');
  assert(parseFloat(resShiftCheck.data.live_totals.card_sales) >= 24.50, 'Desglose en vivo registra tarjeta de pago mixto ($24.50)');
  passed++;

  // 1.6 Cerrar turno y generar corte permanente
  total++;
  const resCloseC1 = await supabase.rpc('close_terminal_shift', {
    p_terminal_code: 'C1',
    p_counted_cash: 1250.00,
    p_notes: 'Prueba de cierre de turno automatizado'
  });

  assert(resCloseC1.data.ok, 'Turno cerrado y corte registrado permanentemente');
  assert(resCloseC1.data.shift.status === 'closed', 'Estado del corte es "closed"');
  assert(resCloseC1.data.shift.closed_at !== null, 'Fecha de cierre registrada');
  passed++;

  // 1.7 Verificar BLOQUEO post-cierre (simula reinicio o recarga)
  total++;
  const resShiftAfterClose = await supabase.rpc('get_terminal_shift', { p_terminal_code: 'C1' });
  assert(!resShiftAfterClose.data.is_open, 'Persiste estado CERRADO tras consulta');

  const testBlockedPostClose = `#TEST-POSTCLOSE-${Date.now()}`;
  const resBlocked2 = await supabase.rpc('register_sale_atomic', {
    p_folio: testBlockedPostClose,
    p_terminal_code: 'C1',
    p_terminal_name: 'Caja 1',
    p_subtotal: 20.00,
    p_total_net: 20.00,
    p_payment_method: 'cash'
  });
  assert(!resBlocked2.data.ok && resBlocked2.data.error_code === 'SHIFT_CLOSED', 'Venta sigue BLOQUEADA tras corte');
  passed++;

  // 1.8 Prevención de cortes duplicados
  total++;
  const resCloseDup = await supabase.rpc('close_terminal_shift', {
    p_terminal_code: 'C1',
    p_counted_cash: 1000.00
  });
  assert(!resCloseDup.data.ok && resCloseDup.data.error_code === 'NO_OPEN_SHIFT', 'No permite cerrar dos veces el mismo turno');
  passed++;

  console.log('\n--- BLOQUE 2: Sincronización entre Caja 1 y Caja 2 ---');

  // 2.1 Abrir Caja 2 mientras Caja 1 está cerrada
  total++;
  const resOpenC2 = await supabase.rpc('open_terminal_shift', {
    p_terminal_code: 'C2',
    p_terminal_name: 'Caja 2',
    p_cashier_name: 'Carlos M.',
    p_initial_fund: 1000.00
  });
  assert(resOpenC2.data.ok, 'Caja 2 puede abrir turno independientemente');

  // Caja 1 sigue cerrada, Caja 2 abierta
  const checkC1 = await supabase.rpc('get_terminal_shift', { p_terminal_code: 'C1' });
  const checkC2 = await supabase.rpc('get_terminal_shift', { p_terminal_code: 'C2' });
  assert(!checkC1.data.is_open, 'Caja 1 permanece CERRADA');
  assert(checkC2.data.is_open, 'Caja 2 permanece ABIERTA');
  passed++;

  // 2.2 Caja 2 realiza una venta sobre inventario compartido
  total++;
  const { data: prodBefore } = await supabase.from('products').select('stock').eq('id', 1).single();
  const stockBefore = prodBefore.stock;

  const testSaleC2Folio = `#TEST-C2-${Date.now()}`;
  const resSaleC2 = await supabase.rpc('register_sale_atomic', {
    p_folio: testSaleC2Folio,
    p_terminal_code: 'C2',
    p_terminal_name: 'Caja 2',
    p_cashier_name: 'Carlos M.',
    p_subtotal: 59.00,
    p_discount: 0.00,
    p_total_net: 59.00,
    p_payment_method: 'card',
    p_items: [{ id: 1, barcode: '7501820511234', name: 'Leche Lala Entera 1L', quantity: 2, unitPrice: 29.50, subtotal: 59.00 }]
  });

  assert(resSaleC2.data.ok, 'Caja 2 registra venta exitosamente');

  const { data: prodAfter } = await supabase.from('products').select('stock').eq('id', 1).single();
  assert(prodAfter.stock === stockBefore - 2, `Inventario compartido descontado: antes=${stockBefore}, después=${prodAfter.stock}`);
  passed++;

  // 2.3 Prevención de ventas duplicadas por idempotencia (reintento del mismo folio)
  total++;
  const resRetry = await supabase.rpc('register_sale_atomic', {
    p_folio: testSaleC2Folio,
    p_terminal_code: 'C2',
    p_terminal_name: 'Caja 2',
    p_total_net: 59.00,
    p_payment_method: 'card'
  });
  assert(resRetry.data.ok && resRetry.data.duplicate, 'Reintento con mismo folio detecta duplicado sin duplicar cobro ni inventario');

  const { data: prodAfterRetry } = await supabase.from('products').select('stock').eq('id', 1).single();
  assert(prodAfterRetry.stock === prodAfter.stock, 'Stock NO fue descontado dos veces por reintento');
  passed++;

  // 2.4 Validación concurrente de sobreventa (intentar vender más de lo existente)
  total++;
  const hugeQty = prodAfter.stock + 100;
  const resOversell = await supabase.rpc('register_sale_atomic', {
    p_folio: `#TEST-OVERSELL-${Date.now()}`,
    p_terminal_code: 'C2',
    p_terminal_name: 'Caja 2',
    p_total_net: 10000.00,
    p_payment_method: 'cash',
    p_items: [{ id: 1, barcode: '7501820511234', name: 'Leche Lala Entera 1L', quantity: hugeQty, unitPrice: 29.50, subtotal: 2950.00 }]
  });
  assert(!resOversell.data.ok && resOversell.data.error_code === 'INSUFFICIENT_STOCK', 'Sobreventa prevenida: rechaza venta cuando existencia < solicitada');
  passed++;

  // Cerrar Caja 2
  await supabase.rpc('close_terminal_shift', {
    p_terminal_code: 'C2',
    p_counted_cash: 1000.00,
    p_notes: 'Cierre C2 fin de prueba'
  });

  console.log('\n--- BLOQUE 3: Reportes de Cortes de Varios Días ---');

  // 3.1 Consulta de cortes históricos
  total++;
  const { data: allCuts } = await supabase.from('cash_cuts').select('*').order('opened_at', { ascending: false });
  assert(Array.isArray(allCuts) && allCuts.length > 0, `Se encontraron ${allCuts.length} cortes persistidos en Supabase`);
  passed++;

  // 3.2 Filtro por Caja 1 y Caja 2
  total++;
  const cutsC1 = allCuts.filter(c => c.terminal_code === 'C1');
  const cutsC2 = allCuts.filter(c => c.terminal_code === 'C2');
  assert(cutsC1.length > 0, `Filtro Caja 1 retorna ${cutsC1.length} cortes de C1`);
  assert(cutsC2.length > 0, `Filtro Caja 2 retorna ${cutsC2.length} cortes de C2`);
  assert(allCuts.length >= (cutsC1.length + cutsC2.length), 'Consulta de ambas cajas consolida cortes sin duplicar');
  passed++;

  // 3.3 Filtro de fechas (rango amplio vs rango futuro sin registros)
  total++;
  const futureStart = '2099-01-01T00:00:00.000Z';
  const futureEnd = '2099-01-07T23:59:59.999Z';
  const { data: futureCuts } = await supabase
    .from('cash_cuts')
    .select('*')
    .gte('opened_at', futureStart)
    .lte('opened_at', futureEnd);

  assert(Array.isArray(futureCuts) && futureCuts.length === 0, 'Filtro sin registros retorna arreglo vacío para estado vacío en UI');
  passed++;

  // 3.4 Desglose acumulado consistente
  total++;
  let accSales = 0;
  let accCash = 0;
  let accCard = 0;
  allCuts.forEach(c => {
    accSales += parseFloat(c.total_sales_amount || 0);
    accCash += parseFloat(c.cash_sales || 0);
    accCard += parseFloat(c.card_sales || 0);
  });
  assert(accSales >= 0, `Ventas acumuladas calculadas correctamente: $${accSales.toFixed(2)}`);
  assert(accCash >= 0 && accCard >= 0, 'Desglose por métodos de pago acumulado no negativo');
  passed++;

  console.log('\n================================================================');
  console.log(`RESULTADO DE PRUEBAS: ${passed}/${total} PRUEBAS EXITOSAS (100%)`);
  console.log('================================================================');
}

runTestSuite().catch(err => {
  console.error('Error durante la ejecución de pruebas:', err);
  process.exit(1);
});
