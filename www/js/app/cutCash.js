/**
 * MÓDULO: CORTE DE CAJA (cutCash.js)
 * Arqueo de efectivo, desglose por método de pago, apertura y cierre de turno en Supabase
 */

function initCutCash() {
  const btnCerrarTurno = document.getElementById('btnCerrarTurno');
  const btnCutPreview = document.getElementById('btnCutPreview');
  const btnCutCancel = document.getElementById('btnCutCancel');
  const btnCutOtherShift = document.getElementById('btnCutOtherShift');
  const btnCutDateSelector = document.getElementById('btnCutDateSelector');
  const inputEfectivoContado = document.getElementById('inputEfectivoContado');

  const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const pad2 = (n) => String(n).padStart(2, '0');
  const formatShortDate = (d) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  const formatTime = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())} hrs`;
  const formatLongDate = (d) => `${pad2(d.getDate())} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;

  async function renderCashCut() {
    const terminalInfo = typeof window.getActiveTerminal === 'function' ? window.getActiveTerminal() : { code: 'C1', name: 'Caja 1' };
    const cutCajaName = document.getElementById('cutCajaName');
    if (cutCajaName) cutCajaName.textContent = terminalInfo.name;

    const dateLabel = document.getElementById('cutCurrentDateLabel');
    if (dateLabel) dateLabel.textContent = `Hoy, ${formatLongDate(new Date())}`;

    let shiftData = null;
    if (window.PosDataService && typeof window.PosDataService.getTerminalShift === 'function') {
      shiftData = await window.PosDataService.getTerminalShift(terminalInfo.code);
    }

    const badgeShiftStatus = document.querySelector('.badge-shift-status');
    const aperturaLabel = document.getElementById('cutAperturaTime');
    const durationLabel = document.getElementById('cutShiftDuration');
    const initialFundLabel = document.getElementById('cutInitialFund');
    const cashierLabel = document.getElementById('cutCashierName');

    if (shiftData && shiftData.is_open && shiftData.shift) {
      const shift = shiftData.shift;
      const start = new Date(shift.opened_at);
      const now = new Date();
      const minutes = Math.max(0, Math.floor((now - start) / 60000));

      if (badgeShiftStatus) {
        badgeShiftStatus.innerHTML = `<span class="dot-shift-active" style="background:#10b981;"></span> Turno en curso`;
        badgeShiftStatus.style.background = '#ecfdf5';
        badgeShiftStatus.style.color = '#065f46';
      }

      if (aperturaLabel) aperturaLabel.textContent = `${formatShortDate(start)} · ${formatTime(start)}`;
      if (durationLabel) durationLabel.textContent = `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
      if (initialFundLabel) initialFundLabel.textContent = `$${parseFloat(shift.initial_fund || 1000).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      if (cashierLabel) cashierLabel.textContent = shift.cashier_name || 'Cajero';

      const live = shiftData.live_totals || {};
      const totalSalesCount = live.total_sales_count || 0;
      const totalSalesAmount = parseFloat(live.total_sales_amount || 0);
      const amountCash = parseFloat(live.cash_sales || 0);
      const amountCard = parseFloat(live.card_sales || 0);
      const amountTransfer = parseFloat(live.transfer_sales || 0);
      const amountMixed = parseFloat(live.mixed_sales || 0);
      const expectedCash = parseFloat(live.expected_cash || (parseFloat(shift.initial_fund || 1000) + amountCash));

      // Resumen de ventas
      const cutTotalSalesHeader = document.getElementById('cutTotalSalesHeader');
      const cutTotalVentasCount = document.getElementById('cutTotalVentasCount');
      if (cutTotalSalesHeader) cutTotalSalesHeader.textContent = `$${totalSalesAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      if (cutTotalVentasCount) cutTotalVentasCount.textContent = `· ${totalSalesCount} venta${totalSalesCount === 1 ? '' : 's'}`;

      // Por método de pago
      const elAmountCash = document.getElementById('cutAmountCash');
      if (elAmountCash) elAmountCash.textContent = `$${amountCash.toFixed(2)}`;

      const elAmountCard = document.getElementById('cutAmountCard');
      if (elAmountCard) elAmountCard.textContent = `$${amountCard.toFixed(2)}`;

      const elAmountTransfer = document.getElementById('cutAmountTransfer');
      if (elAmountTransfer) elAmountTransfer.textContent = `$${amountTransfer.toFixed(2)}`;

      const elAmountMixed = document.getElementById('cutAmountMixed');
      if (elAmountMixed) elAmountMixed.textContent = `$${amountMixed.toFixed(2)}`;

      // Conteo de operaciones por método
      const elCountCash = document.getElementById('cutCountCash');
      if (elCountCash) elCountCash.textContent = live.cash_sales_count || (amountCash > 0 ? '—' : '0');
      const elCountCard = document.getElementById('cutCountCard');
      if (elCountCard) elCountCard.textContent = live.card_sales_count || (amountCard > 0 ? '—' : '0');
      const elCountTransfer = document.getElementById('cutCountTransfer');
      if (elCountTransfer) elCountTransfer.textContent = live.transfer_sales_count || (amountTransfer > 0 ? '—' : '0');
      const elCountMixed = document.getElementById('cutCountMixed');
      if (elCountMixed) elCountMixed.textContent = live.mixed_sales_count || (amountMixed > 0 ? '—' : '0');

      // Pie de tabla
      const elFootCount = document.getElementById('cutFootTotalCount');
      const elFootAmount = document.getElementById('cutFootTotalAmount');
      if (elFootCount) elFootCount.textContent = totalSalesCount;
      if (elFootAmount) elFootAmount.textContent = `$${totalSalesAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      // Movimientos de caja registrados en el día / turno
      const elMoveVentasCount = document.getElementById('cutMoveVentasCount');
      const elMoveVentasAmount = document.getElementById('cutMoveVentasAmount');
      if (elMoveVentasCount) elMoveVentasCount.textContent = totalSalesCount;
      if (elMoveVentasAmount) elMoveVentasAmount.textContent = `$${totalSalesAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      const elMoveEntriesAmount = document.getElementById('cutMoveEntriesAmount');
      if (elMoveEntriesAmount) elMoveEntriesAmount.textContent = `+ $${parseFloat(shift.cash_inflows || 0).toFixed(2)}`;

      const elMoveExitsAmount = document.getElementById('cutMoveExitsAmount');
      if (elMoveExitsAmount) elMoveExitsAmount.textContent = `- $${parseFloat(shift.cash_outflows || 0).toFixed(2)}`;

      const elMoveSupplierAmount = document.getElementById('cutMoveSupplierAmount');
      if (elMoveSupplierAmount) elMoveSupplierAmount.textContent = `- $${parseFloat(shift.supplier_payouts || 0).toFixed(2)}`;

      // Conteo de efectivo esperado
      const elExpectedCash = document.getElementById('cutExpectedCash');
      if (elExpectedCash) elExpectedCash.textContent = `$${expectedCash.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      if (inputEfectivoContado) {
        if (!inputEfectivoContado.value || inputEfectivoContado.value === '1,000.00' || inputEfectivoContado.value === '0.00') {
          inputEfectivoContado.value = expectedCash.toFixed(2);
        }
      }

      if (btnCerrarTurno) {
        btnCerrarTurno.disabled = false;
        btnCerrarTurno.style.opacity = '1';
        btnCerrarTurno.style.cursor = 'pointer';
        const span = btnCerrarTurno.querySelector('span');
        if (span) span.textContent = 'Cerrar turno y generar corte';
      }
    } else {
      // TURNO CERRADO
      if (badgeShiftStatus) {
        badgeShiftStatus.innerHTML = `<span class="dot-shift-active" style="background:#ef4444;"></span> Turno cerrado`;
        badgeShiftStatus.style.background = '#fef2f2';
        badgeShiftStatus.style.color = '#991b1b';
      }

      const last = (shiftData && shiftData.last_shift) || {};
      if (aperturaLabel) aperturaLabel.textContent = last.opened_at ? `${formatShortDate(new Date(last.opened_at))} · ${formatTime(new Date(last.opened_at))}` : 'Sin apertura';
      if (durationLabel) durationLabel.textContent = last.closed_at ? 'Cerrado' : '0 h 0 min';
      if (initialFundLabel) initialFundLabel.textContent = `$${parseFloat(last.initial_fund || 1000).toFixed(2)}`;

      const cutTotalSalesHeader = document.getElementById('cutTotalSalesHeader');
      const cutTotalVentasCount = document.getElementById('cutTotalVentasCount');
      if (cutTotalSalesHeader) cutTotalSalesHeader.textContent = `$${parseFloat(last.total_sales_amount || 0).toFixed(2)}`;
      if (cutTotalVentasCount) cutTotalVentasCount.textContent = `· ${last.total_sales_count || 0} ventas (último corte)`;

      const elExpectedCash = document.getElementById('cutExpectedCash');
      if (elExpectedCash) elExpectedCash.textContent = `$${parseFloat(last.expected_cash || 1000).toFixed(2)}`;

      if (btnCerrarTurno) {
        btnCerrarTurno.disabled = true;
        btnCerrarTurno.style.opacity = '0.5';
        btnCerrarTurno.style.cursor = 'not-allowed';
        const span = btnCerrarTurno.querySelector('span');
        if (span) span.textContent = 'Turno ya cerrado';
      }
    }
  }

  window.renderCashCut = renderCashCut;

  // Botón Cerrar Turno
  if (btnCerrarTurno) {
    btnCerrarTurno.addEventListener('click', async () => {
      const terminalInfo = typeof window.getActiveTerminal === 'function' ? window.getActiveTerminal() : { code: 'C1', name: 'Caja 1' };
      const contadoStr = inputEfectivoContado ? inputEfectivoContado.value.replace(/,/g, '').trim() : '0';
      const contadoVal = parseFloat(contadoStr) || 0;

      btnCerrarTurno.disabled = true;
      const originalText = btnCerrarTurno.querySelector('span')?.textContent;
      if (btnCerrarTurno.querySelector('span')) btnCerrarTurno.querySelector('span').textContent = 'Guardando corte en Supabase...';

      const res = await window.PosDataService.closeTerminalShift(
        terminalInfo.code,
        contadoVal,
        `Cierre de turno realizado desde ${terminalInfo.name}`
      );

      btnCerrarTurno.disabled = false;
      if (btnCerrarTurno.querySelector('span')) btnCerrarTurno.querySelector('span').textContent = originalText;

      if (!res || !res.ok) {
        showModal('Error al cerrar turno', res?.error || 'No se pudo guardar el corte en Supabase.');
        return;
      }

      const closed = res.shift || {};
      const totVentas = parseFloat(closed.total_sales_amount || 0).toFixed(2);
      const totCant = closed.total_sales_count || 0;
      const efecEsp = parseFloat(closed.expected_cash || 0).toFixed(2);
      const efecCont = parseFloat(closed.counted_cash || 0).toFixed(2);

      // Notificar cambio de turno a toda la aplicación
      if (typeof window.checkShiftState === 'function') {
        await window.checkShiftState();
      }

      renderCashCut();

      showModal(
        'Turno Cerrado con Éxito',
        `El corte de ${terminalInfo.name} ha sido guardado PERMANENTEMENTE en Supabase.\n\n` +
        `• Caja: ${terminalInfo.name} (${terminalInfo.code})\n` +
        `• Ventas totales: $${totVentas} (${totCant} ventas)\n` +
        `  - Efectivo: $${parseFloat(closed.cash_sales || 0).toFixed(2)}\n` +
        `  - Tarjeta: $${parseFloat(closed.card_sales || 0).toFixed(2)}\n` +
        `  - Transferencia/QR: $${parseFloat(closed.transfer_sales || 0).toFixed(2)}\n` +
        `  - Mixto: $${parseFloat(closed.mixed_sales || 0).toFixed(2)}\n` +
        `• Efectivo esperado: $${efecEsp}\n` +
        `• Efectivo contado: $${efecCont}\n\n` +
        `IMPORTANTE: Las ventas en ${terminalInfo.name} quedan BLOQUEADAS hasta abrir un nuevo turno.`
      );
    });
  }

  // Vista Previa de Corte
  if (btnCutPreview) {
    btnCutPreview.addEventListener('click', async () => {
      const terminalInfo = typeof window.getActiveTerminal === 'function' ? window.getActiveTerminal() : { code: 'C1', name: 'Caja 1' };
      const shiftData = await window.PosDataService.getTerminalShift(terminalInfo.code);
      const now = new Date();

      if (!shiftData || !shiftData.is_open) {
        showModal('Sin Turno Abierto', `La ${terminalInfo.name} no tiene un turno en curso para previsualizar.`);
        return;
      }

      const shift = shiftData.shift || {};
      const live = shiftData.live_totals || {};
      const contadoStr = inputEfectivoContado ? inputEfectivoContado.value : '0.00';

      showModal(
        'Vista Previa: Comprobante de Corte',
        `========================================\n` +
        `         TIENDA ABARROTES NEXUS\n` +
        `      COMPROBANTE DE CORTE DE CAJA\n` +
        `========================================\n` +
        `Caja: ${terminalInfo.name} (${terminalInfo.code})\n` +
        `Fecha: ${formatShortDate(now)} ${formatTime(now)}\n` +
        `Apertura: ${formatShortDate(new Date(shift.opened_at))} ${formatTime(new Date(shift.opened_at))}\n` +
        `----------------------------------------\n` +
        `Fondo inicial:        $${parseFloat(shift.initial_fund || 1000).toFixed(2)}\n` +
        `Ventas Totales (${live.total_sales_count || 0}):   $${parseFloat(live.total_sales_amount || 0).toFixed(2)}\n` +
        `  - Efectivo:         $${parseFloat(live.cash_sales || 0).toFixed(2)}\n` +
        `  - Tarjeta:          $${parseFloat(live.card_sales || 0).toFixed(2)}\n` +
        `  - Transferencia/QR: $${parseFloat(live.transfer_sales || 0).toFixed(2)}\n` +
        `  - Pago Mixto:       $${parseFloat(live.mixed_sales || 0).toFixed(2)}\n` +
        `----------------------------------------\n` +
        `Efectivo esperado:    $${parseFloat(live.expected_cash || 0).toFixed(2)}\n` +
        `Efectivo contado:     $${contadoStr}\n` +
        `========================================`
      );
    });
  }

  if (btnCutCancel) {
    btnCutCancel.addEventListener('click', () => {
      window.switchView('pos');
    });
  }

  // Ver otros turnos / Histórico de cortes -> Abre módulo de Reportes
  if (btnCutOtherShift) {
    btnCutOtherShift.addEventListener('click', () => {
      if (typeof window.switchView === 'function') {
        window.switchView('reports');
      }
    });
  }

  if (btnCutDateSelector) {
    btnCutDateSelector.addEventListener('click', () => {
      if (typeof window.switchView === 'function') {
        window.switchView('reports');
      }
    });
  }

  window.renderCashCut = renderCashCut;
}

window.initCutCash = initCutCash;
