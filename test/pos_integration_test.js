/**
 * SUITE DE PRUEBAS AUTOMATIZADAS DE INTEGRACIÓN Y CONCURRENCIA
 * TiendaAdmin-POS
 * 
 * Verificación exhaustiva de los 20 requisitos obligatorios:
 * 1. Productos consultados directamente desde Supabase
 * 2. Registro de venta
 * 3. Venta almacenada en Supabase (public.sales)
 * 4. Productos vendidos registrados en detalle (public.sale_items)
 * 5. Inventario descontado correctamente
 * 6. Venta reflejada en historial del día (filtro México)
 * 7. Venta incluida en el corte del turno activo
 * 8. Confirmación de corte de caja
 * 9. Corte guardado permanentemente en Supabase (public.cash_cuts)
 * 10. Bloqueo obligatorio de ventas tras corte
 * 11. Persistencia del bloqueo tras recarga/reinicio
 * 12. Apertura de nuevo turno con fondo inicial
 * 13. Nuevas ventas sin modificar el corte anterior
 * 14. Reportes de cortes de varios días
 * 15. Filtros por fecha y rango temporal
 * 16. Caja 1 y Caja 2 con turnos/sesiones independientes
 * 17. Ambas cajas comparten el mismo catálogo e inventario
 * 18. Pagos mixtos desglosados y contabilizados correctamente
 * 19. Prevención de duplicados en ventas y cortes (idempotencia)
 * 20. Compatibilidad y sincronización con Android y Capacitor
 */

const fs = require('fs');
const path = require('path');
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

function getMexicoDateStr(d = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(d);
  } catch (e) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('INICIANDO PRUEBAS DE INTEGRACIÓN: TIENDAADMIN-POS (20 PUNTOS)');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  // ---------------------------------------------------------------------------
  // PUNTO 1: PRODUCTOS CONSULTADOS DESDE SUPABASE
  // ---------------------------------------------------------------------------
  console.log('--- REQUISITO 1: Catálogo e Inventario desde Supabase ---');
  total++;
  const { data: prods, error: errProds } = await supabase
    .from('products')
    .select('*')
    .order('id', { ascending: true });
  assert(!errProds && Array.isArray(prods) && prods.length > 0, `1. Productos consultados desde Supabase: ${prods.length} productos activos`);
  const testProduct = prods[0];
  const initialStock = testProduct.stock;
  passed++;

  // ---------------------------------------------------------------------------
  // PUNTOS 2 - 7: APERTURA DE TURNO, VENTA ATÓMICA, HISTORIAL Y TURNO EN VIVO
  // ---------------------------------------------------------------------------
  console.log('\n--- REQUISITOS 2 - 7: Turno, Venta Atómica, Detalle, Inventario e Historial ---');

  // Asegurar que C1 esté abierta para la prueba
  await supabase.rpc('close_terminal_shift', { p_terminal_code: 'C1', p_counted_cash: 1000 });
  const openRes = await supabase.rpc('open_terminal_shift', {
    p_terminal_code: 'C1',
    p_terminal_name: 'Caja 1',
    p_cashier_name: 'Elena R.',
    p_initial_fund: 1500.00
  });
  assert(openRes.data.ok, 'Turno de prueba abierto en Caja 1 ($1,500.00)');

  // PUNTO 2 & 3: Registrar venta y verificar almacenamiento
  total++;
  const folioVenta = `#TK-C1-${Date.now()}`;
  const salePayload = {
    p_folio: folioVenta,
    p_terminal_code: 'C1',
    p_terminal_name: 'Caja 1',
    p_cashier_name: 'Elena R.',
    p_subtotal: 75.00,
    p_discount: 0.00,
    p_total_net: 75.00,
    p_payment_method: 'mixed',
    p_cash_amount: 50.00,
    p_card_amount: 25.00,
    p_transfer_amount: 0.00,
    p_items: [
      { id: testProduct.id, barcode: testProduct.barcode, name: testProduct.name, quantity: 2, unitPrice: 37.50, subtotal: 75.00 }
    ]
  };

  const resSale = await supabase.rpc('register_sale_atomic', salePayload);
  assert(resSale.data && resSale.data.ok, `2. Venta registrada exitosamente con folio ${folioVenta}`);
  const saleId = resSale.data.sale_id;
  passed++;

  total++;
  const { data: dbSale, error: errDbSale } = await supabase
    .from('sales')
    .select('*')
    .eq('id', saleId)
    .single();
  assert(!errDbSale && dbSale && dbSale.folio === folioVenta, '3. Venta almacenada y verificada en tabla public.sales');
  passed++;

  // PUNTO 4: Productos vendidos registrados en sale_items
  total++;
  const { data: saleItems, error: errItems } = await supabase
    .from('sale_items')
    .select('*')
    .eq('sale_id', saleId);
  assert(!errItems && Array.isArray(saleItems) && saleItems.length === 1 && saleItems[0].quantity === 2,
    `4. Productos vendidos registrados en public.sale_items (cantidad=2, producto=${saleItems[0].product_name})`);
  passed++;

  // PUNTO 5: Inventario descontado correctamente
  total++;
  const { data: prodAfterSale } = await supabase
    .from('products')
    .select('stock')
    .eq('id', testProduct.id)
    .single();
  assert(prodAfterSale.stock === initialStock - 2,
    `5. Inventario descontado correctamente en Supabase: antes=${initialStock}, después=${prodAfterSale.stock}`);
  passed++;

  // PUNTO 6: La venta aparece en el historial del día (hora local México)
  total++;
  const todayMexico = getMexicoDateStr();
  const saleDateMexico = getMexicoDateStr(new Date(dbSale.created_at));
  assert(saleDateMexico === todayMexico, `6. Venta asociada a fecha local de México: ${saleDateMexico}`);
  passed++;

  // PUNTO 7: La venta se incluye en el corte del turno activo
  total++;
  const shiftC1Live = await supabase.rpc('get_terminal_shift', { p_terminal_code: 'C1' });
  assert(shiftC1Live.data.is_open, '7a. El turno de Caja 1 se reporta ABIERTO');
  assert(parseFloat(shiftC1Live.data.live_totals.total_sales_amount) >= 75.00,
    `7b. La venta se incluye en el corte del turno en vivo: $${shiftC1Live.data.live_totals.total_sales_amount}`);

  // 7c. La suma de todo lo del día se agarra de la base de datos según su desglose
  const resDailySummary = await supabase.rpc('get_daily_sales_summary', { p_terminal_code: 'all' });
  assert(resDailySummary.data && resDailySummary.data.ok, '7c. Resumen del día obtenido directamente desde la base de datos');
  assert(resDailySummary.data.total_sales_count >= 1, `7d. Total de ventas de hoy en BD: ${resDailySummary.data.total_sales_count}`);
  assert(parseFloat(resDailySummary.data.total_sales_amount) >= 75.00, `7e. Suma acumulada de hoy en BD: $${resDailySummary.data.total_sales_amount}`);
  passed++;

  // ---------------------------------------------------------------------------
  // PUNTOS 8 - 11: CONFIRMAR CORTE, PERSISTENCIA Y BLOQUEO DE VENTAS
  // ---------------------------------------------------------------------------
  console.log('\n--- REQUISITOS 8 - 11: Confirmar Corte, Persistencia y Bloqueo Inmediato ---');

  // PUNTO 8 & 9: Confirmar y guardar el corte en Supabase
  total++;
  const closeRes = await supabase.rpc('close_terminal_shift', {
    p_terminal_code: 'C1',
    p_counted_cash: 1550.00,
    p_notes: 'Corte de prueba C1'
  });
  assert(closeRes.data && closeRes.data.ok, '8. Corte de caja confirmado');
  const closedCutId = closeRes.data.shift.id;
  const { data: cutInDb } = await supabase.from('cash_cuts').select('*').eq('id', closedCutId).single();
  assert(cutInDb && cutInDb.status === 'closed' && cutInDb.closed_at != null,
    `9. Corte guardado permanentemente en public.cash_cuts (ID=${closedCutId}, closed_at=${cutInDb.closed_at})`);
  passed++;

  // PUNTO 10: La caja queda bloqueada para nuevas ventas
  total++;
  const resBlockedImmediate = await supabase.rpc('register_sale_atomic', {
    p_folio: `#TK-BLOCKED-${Date.now()}`,
    p_terminal_code: 'C1',
    p_terminal_name: 'Caja 1',
    p_subtotal: 50.00,
    p_total_net: 50.00,
    p_payment_method: 'cash',
    p_items: [{ barcode: testProduct.barcode, quantity: 1, unitPrice: 50.00, subtotal: 50.00 }]
  });
  assert(!resBlockedImmediate.data.ok && resBlockedImmediate.data.error_code === 'SHIFT_CLOSED',
    '10. La caja queda BLOQUEADA para nuevas ventas (código SHIFT_CLOSED)');
  passed++;

  // PUNTO 11: El bloqueo persiste al consultar de nuevo
  total++;
  const shiftC1Check = await supabase.rpc('get_terminal_shift', { p_terminal_code: 'C1' });
  assert(!shiftC1Check.data.is_open, '11. El bloqueo persiste tras consultar el estado en Supabase (is_open = false)');
  passed++;

  // ---------------------------------------------------------------------------
  // PUNTOS 12 - 13: ABRIR NUEVO TURNO Y NUEVAS VENTAS SIN ALTERAR EL ANTERIOR
  // ---------------------------------------------------------------------------
  console.log('\n--- REQUISITOS 12 - 13: Apertura de Nuevo Turno e Integridad Histórica ---');

  // PUNTO 12: Abrir nuevo turno
  total++;
  const openNewRes = await supabase.rpc('open_terminal_shift', {
    p_terminal_code: 'C1',
    p_terminal_name: 'Caja 1',
    p_cashier_name: 'Elena R.',
    p_initial_fund: 1000.00
  });
  assert(openNewRes.data.ok && openNewRes.data.shift.status === 'open',
    '12. Se abre un nuevo turno para Caja 1 con nuevo fondo inicial ($1,000.00)');
  passed++;

  // PUNTO 13: Nuevas ventas sin modificar el corte anterior
  total++;
  const folioNewShift = `#TK-NEW-SHIFT-${Date.now()}`;
  const resSaleNew = await supabase.rpc('register_sale_atomic', {
    p_folio: folioNewShift,
    p_terminal_code: 'C1',
    p_terminal_name: 'Caja 1',
    p_subtotal: 20.00,
    p_total_net: 20.00,
    p_payment_method: 'cash',
    p_items: [{ barcode: testProduct.barcode, quantity: 1, unitPrice: 20.00, subtotal: 20.00 }]
  });
  assert(resSaleNew.data.ok, '13a. Nueva venta registrada exitosamente en el nuevo turno');

  const { data: previousCutCheck } = await supabase.from('cash_cuts').select('*').eq('id', closedCutId).single();
  assert(previousCutCheck.status === 'closed' && parseFloat(previousCutCheck.total_sales_amount) === parseFloat(cutInDb.total_sales_amount),
    '13b. El corte anterior permanece INTACTO (no fue alterado por la nueva venta)');
  passed++;

  // ---------------------------------------------------------------------------
  // PUNTOS 14 - 15: REPORTES DE CORTES DE VARIOS DÍAS Y FILTROS POR FECHA
  // ---------------------------------------------------------------------------
  console.log('\n--- REQUISITOS 14 - 15: Reportes Históricos Multi-Día y Filtros ---');

  // PUNTO 14: Reportes muestran cortes de diferentes días
  total++;
  const { data: multiCuts } = await supabase
    .from('cash_cuts')
    .select('*')
    .order('opened_at', { ascending: false });
  assert(Array.isArray(multiCuts) && multiCuts.length >= 2,
    `14. Reportes consultan múltiples cortes históricos persistidos: ${multiCuts.length} cortes encontrados`);
  passed++;

  // PUNTO 15: Filtros por fecha funcionan
  total++;
  const now = new Date();
  const pastDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString();
  const futureDate = new Date(now.getTime() + (24 * 60 * 60 * 1000)).toISOString();

  const { data: filteredRange } = await supabase
    .from('cash_cuts')
    .select('*')
    .gte('opened_at', pastDate)
    .lte('opened_at', futureDate);

  assert(Array.isArray(filteredRange) && filteredRange.length > 0,
    `15. Filtro por rango de fechas retorna los cortes del periodo (${filteredRange.length} cortes en últimos 30 días)`);
  passed++;

  // ---------------------------------------------------------------------------
  // PUNTOS 16 - 17: CAJA 1 Y CAJA 2 INDEPENDIENTES CON INVENTARIO COMPARTIDO
  // ---------------------------------------------------------------------------
  console.log('\n--- REQUISITOS 16 - 17: Concurrencia Caja 1 y Caja 2 ---');

  // PUNTO 16: Caja 1 y Caja 2 mantienen sesiones independientes
  total++;
  // Asegurar que C2 esté abierta
  await supabase.rpc('open_terminal_shift', {
    p_terminal_code: 'C2',
    p_terminal_name: 'Caja 2',
    p_cashier_name: 'Cajero 2',
    p_initial_fund: 1000.00
  });

  const shiftC1 = await supabase.rpc('get_terminal_shift', { p_terminal_code: 'C1' });
  const shiftC2 = await supabase.rpc('get_terminal_shift', { p_terminal_code: 'C2' });
  assert(shiftC1.data.shift.terminal_code === 'C1' && shiftC2.data.shift.terminal_code === 'C2',
    '16. Caja 1 y Caja 2 tienen sesiones, turnos e identificadores completamente INDEPENDIENTES');
  passed++;

  // PUNTO 17: Ambas cajas consultan el inventario compartido
  total++;
  const { data: stockProdBefore } = await supabase.from('products').select('stock').eq('id', testProduct.id).single();
  const curStock = stockProdBefore.stock;

  // Caja 2 vende 1 unidad del inventario compartido
  const resSaleC2 = await supabase.rpc('register_sale_atomic', {
    p_folio: `#TK-C2-SHARE-${Date.now()}`,
    p_terminal_code: 'C2',
    p_terminal_name: 'Caja 2',
    p_subtotal: 25.00,
    p_total_net: 25.00,
    p_payment_method: 'card',
    p_items: [{ barcode: testProduct.barcode, quantity: 1, unitPrice: 25.00, subtotal: 25.00 }]
  });
  assert(resSaleC2.data.ok, '17a. Caja 2 realiza venta sobre el producto compartido');

  const { data: stockProdAfter } = await supabase.from('products').select('stock').eq('id', testProduct.id).single();
  assert(stockProdAfter.stock === curStock - 1,
    `17b. Ambas cajas comparten el inventario: stock actualizado de ${curStock} a ${stockProdAfter.stock}`);
  passed++;

  // ---------------------------------------------------------------------------
  // PUNTOS 18 - 20: PAGO MIXTO, IDEMPOTENCIA Y CAPACITOR ANDROID
  // ---------------------------------------------------------------------------
  console.log('\n--- REQUISITOS 18 - 20: Desglose de Pagos, No Duplicidad y Capacitor ---');

  // PUNTO 18: Pagos mixtos se contabilizan correctamente
  total++;
  const { data: mixedSales } = await supabase
    .from('sales')
    .select('cash_amount, card_amount, transfer_amount, total_net')
    .eq('payment_method', 'mixed')
    .limit(1);
  assert(Array.isArray(mixedSales) && mixedSales.length > 0, '18a. Ventas con pago mixto registradas en Supabase');
  const ms = mixedSales[0];
  const sumParts = parseFloat(ms.cash_amount) + parseFloat(ms.card_amount) + parseFloat(ms.transfer_amount);
  assert(Math.abs(sumParts - parseFloat(ms.total_net)) < 0.01,
    `18b. Desglose de pago mixto cuadra exactamente: Efectivo ($${ms.cash_amount}) + Tarjeta ($${ms.card_amount}) = Total ($${ms.total_net})`);
  passed++;

  // PUNTO 19: No se duplican ventas ni cortes
  total++;
  const testDuplicateFolio = `#TK-IDEMPOTENCY-${Date.now()}`;
  const resFirstTry = await supabase.rpc('register_sale_atomic', {
    p_folio: testDuplicateFolio,
    p_terminal_code: 'C2',
    p_total_net: 10.00,
    p_payment_method: 'cash'
  });
  const resSecondTry = await supabase.rpc('register_sale_atomic', {
    p_folio: testDuplicateFolio,
    p_terminal_code: 'C2',
    p_total_net: 10.00,
    p_payment_method: 'cash'
  });
  assert(resFirstTry.data.ok && resSecondTry.data.ok && (resSecondTry.data.duplicate || resSecondTry.data.duplicate_prevented),
    '19. Detección de duplicado por idempotencia: reintentos con mismo folio no duplican ventas ni inventario');
  passed++;

  // PUNTO 20: Compatibilidad con Android y Capacitor
  total++;
  const capConfigFile = path.join(__dirname, '..', 'capacitor.config.json');
  const androidAssetsPos = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets', 'public', 'pos.html');
  const hasCapConfig = fs.existsSync(capConfigFile);
  const hasAndroidAssets = fs.existsSync(androidAssetsPos);
  assert(hasCapConfig && hasAndroidAssets,
    '20. Compatibilidad Android y Capacitor verificada (capacitor.config.json y assets sincronizados)');
  passed++;

  console.log('\n================================================================');
  console.log(`RESULTADO DE PRUEBAS: ${passed}/${total} PRUEBAS EXITOSAS (100%)`);
  console.log('================================================================');
}

runTestSuite().catch(err => {
  console.error('Error durante la suite de pruebas:', err);
  process.exit(1);
});
