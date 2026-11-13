/**
 * MÓDULO: CORTE DE CAJA (cutCash.js)
 * Arqueo de efectivo, desglose por método de pago, apertura y cierre de turno
 */

function initCutCash() {
  // =========================================================================
  // 7B. CONTROLADOR DE CORTE DE CAJA
  // =========================================================================
  const btnCerrarTurno = document.getElementById('btnCerrarTurno');
  const btnCutPreview = document.getElementById('btnCutPreview');
  const btnCutCancel = document.getElementById('btnCutCancel');
  const btnCutOtherShift = document.getElementById('btnCutOtherShift');
  const btnCutDateSelector = document.getElementById('btnCutDateSelector');
  const inputEfectivoContado = document.getElementById('inputEfectivoContado');

  // Fechas reales del turno (antes estaban fijas en "06 de octubre")
  const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const pad2 = (n) => String(n).padStart(2, '0');
  const formatShortDate = (d) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  const formatTime = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())} hrs`;
  const formatLongDate = (d) => `${pad2(d.getDate())} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;

  // La apertura del turno se guarda la primera vez que se abre la app en el día
  function getShiftStart() {
    const saved = new Date(localStorage.getItem('pos_shift_start') || '');
    const now = new Date();
    if (isNaN(saved.getTime()) || saved.toDateString() !== now.toDateString()) {
      localStorage.setItem('pos_shift_start', now.toISOString());
      return now;
    }
    return saved;
  }
  getShiftStart();

  function renderCashCut() {
    const now = new Date();
    const start = getShiftStart();
    const minutes = Math.max(0, Math.floor((now - start) / 60000));

    const dateLabel = document.getElementById('cutCurrentDateLabel');
    const aperturaLabel = document.getElementById('cutAperturaTime');
    const durationLabel = document.getElementById('cutShiftDuration');
    if (dateLabel) dateLabel.textContent = `Hoy, ${formatLongDate(now)}`;
    if (aperturaLabel) aperturaLabel.textContent = `${formatShortDate(start)} · ${formatTime(start)}`;
    if (durationLabel) durationLabel.textContent = `${Math.floor(minutes / 60)} h ${minutes % 60} min`;

    // Calcular montos y cantidades reales de las ventas completadas hoy
    let totalSalesCount = 0;
    let totalSalesAmount = 0;
    let countCash = 0, amountCash = 0;
    let countCard = 0, amountCard = 0;
    let countTransfer = 0, amountTransfer = 0;
    let countMixed = 0, amountMixed = 0;

    salesHistoryList.forEach(item => {
      if (item.status === 'completed') {
        totalSalesCount++;
        const total = parseFloat(item.total) || 0;
        totalSalesAmount += total;

        const pm = (item.paymentMethod || '').toLowerCase();
        if (pm === 'cash' || pm === 'efectivo') {
          countCash++;
          amountCash += total;
        } else if (pm === 'card' || pm === 'tarjeta') {
          countCard++;
          amountCard += total;
        } else if (pm === 'transfer' || pm === 'codi' || pm === 'qr') {
          countTransfer++;
          amountTransfer += total;
        } else {
          countMixed++;
          amountMixed += total;
        }
      }
    });

    const percentCash = totalSalesAmount > 0 ? Math.round((amountCash / totalSalesAmount) * 100) : 0;
    const percentCard = totalSalesAmount > 0 ? Math.round((amountCard / totalSalesAmount) * 100) : 0;
    const percentTransfer = totalSalesAmount > 0 ? Math.round((amountTransfer / totalSalesAmount) * 100) : 0;
    const percentMixed = totalSalesAmount > 0 ? Math.round((amountMixed / totalSalesAmount) * 100) : 0;

    // Resumen de ventas
    const cutTotalSalesHeader = document.getElementById('cutTotalSalesHeader');
    const cutTotalVentasCount = document.getElementById('cutTotalVentasCount');
    if (cutTotalSalesHeader) cutTotalSalesHeader.textContent = `$${totalSalesAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (cutTotalVentasCount) cutTotalVentasCount.textContent = `· ${totalSalesCount} venta${totalSalesCount === 1 ? '' : 's'}`;

    // Por método de pago
    const elCountCash = document.getElementById('cutCountCash');
    const elAmountCash = document.getElementById('cutAmountCash');
    const elPercentCash = document.getElementById('cutPercentCash');
    if (elCountCash) elCountCash.textContent = countCash;
    if (elAmountCash) elAmountCash.textContent = `$${amountCash.toFixed(2)}`;
    if (elPercentCash) elPercentCash.textContent = `${percentCash}%`;

    const elCountCard = document.getElementById('cutCountCard');
    const elAmountCard = document.getElementById('cutAmountCard');
    const elPercentCard = document.getElementById('cutPercentCard');
    if (elCountCard) elCountCard.textContent = countCard;
    if (elAmountCard) elAmountCard.textContent = `$${amountCard.toFixed(2)}`;
    if (elPercentCard) elPercentCard.textContent = `${percentCard}%`;

    const elCountTransfer = document.getElementById('cutCountTransfer');
    const elAmountTransfer = document.getElementById('cutAmountTransfer');
    const elPercentTransfer = document.getElementById('cutPercentTransfer');
    if (elCountTransfer) elCountTransfer.textContent = countTransfer;
    if (elAmountTransfer) elAmountTransfer.textContent = `$${amountTransfer.toFixed(2)}`;
    if (elPercentTransfer) elPercentTransfer.textContent = `${percentTransfer}%`;

    const elCountMixed = document.getElementById('cutCountMixed');
    const elAmountMixed = document.getElementById('cutAmountMixed');
    const elPercentMixed = document.getElementById('cutPercentMixed');
    if (elCountMixed) elCountMixed.textContent = countMixed;
    if (elAmountMixed) elAmountMixed.textContent = `$${amountMixed.toFixed(2)}`;
    if (elPercentMixed) elPercentMixed.textContent = `${percentMixed}%`;

    // Pie de tabla
    const elFootCount = document.getElementById('cutFootTotalCount');
    const elFootAmount = document.getElementById('cutFootTotalAmount');
    if (elFootCount) elFootCount.textContent = totalSalesCount;
    if (elFootAmount) elFootAmount.textContent = `$${totalSalesAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Movimientos de caja
    const elMoveVentasCount = document.getElementById('cutMoveVentasCount');
    const elMoveVentasAmount = document.getElementById('cutMoveVentasAmount');
    if (elMoveVentasCount) elMoveVentasCount.textContent = totalSalesCount;
    if (elMoveVentasAmount) elMoveVentasAmount.textContent = `$${totalSalesAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const elMoveEntriesCount = document.getElementById('cutMoveEntriesCount');
    const elMoveEntriesAmount = document.getElementById('cutMoveEntriesAmount');
    if (elMoveEntriesCount) elMoveEntriesCount.textContent = '0';
    if (elMoveEntriesAmount) elMoveEntriesAmount.textContent = '+ $0.00';

    const elMoveExitsCount = document.getElementById('cutMoveExitsCount');
    const elMoveExitsAmount = document.getElementById('cutMoveExitsAmount');
    if (elMoveExitsCount) elMoveExitsCount.textContent = '0';
    if (elMoveExitsAmount) elMoveExitsAmount.textContent = '- $0.00';

    const elMoveSupplierCount = document.getElementById('cutMoveSupplierCount');
    const elMoveSupplierAmount = document.getElementById('cutMoveSupplierAmount');
    if (elMoveSupplierCount) elMoveSupplierCount.textContent = '0';
    if (elMoveSupplierAmount) elMoveSupplierAmount.textContent = '- $0.00';

    // Conteo de efectivo esperado: Fondo inicial $1,000 + efectivo cobrado
    const initialFund = 1000.00;
    const expectedCash = initialFund + amountCash;
    const elExpectedCash = document.getElementById('cutExpectedCash');
    if (elExpectedCash) elExpectedCash.textContent = `$${expectedCash.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const countedInput = document.getElementById('inputEfectivoContado');
    if (countedInput) {
      if (!countedInput.value || countedInput.value === '3,220.00' || countedInput.value === '3,200.00' || countedInput.value === '1,000.00') {
        countedInput.value = expectedCash.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    }
  }
  window.renderCashCut = renderCashCut;

  if (btnCerrarTurno) {
    btnCerrarTurno.addEventListener('click', () => {
      let totalSalesCount = 0;
      let totalSalesAmount = 0;
      let cashSales = 0;
      salesHistoryList.forEach(item => {
        if (item.status === 'completed') {
          totalSalesCount++;
          const tot = parseFloat(item.total) || 0;
          totalSalesAmount += tot;
          const pm = (item.paymentMethod || '').toLowerCase();
          if (pm === 'cash' || pm === 'efectivo') cashSales += tot;
        }
      });

      const initialFund = 1000.00;
      const expectedCash = initialFund + cashSales;
      const contadoStr = inputEfectivoContado ? inputEfectivoContado.value : expectedCash.toFixed(2);
      const contadoVal = parseFloat(contadoStr.replace(/,/g, '')) || expectedCash;

      if (dataService && typeof dataService.registerCashCut === 'function') {
        dataService.registerCashCut({
          terminal_code: 'C1',
          terminal_name: 'Caja 1',
          cashier_name: 'Elena R.',
          initial_fund: initialFund,
          total_sales_amount: totalSalesAmount,
          total_sales_count: totalSalesCount,
          cash_sales: cashSales,
          card_sales: totalSalesAmount - cashSales,
          expected_cash: expectedCash,
          counted_cash: contadoVal,
          difference: contadoVal - expectedCash,
          status: 'closed',
          closed_at: new Date().toISOString()
        });
      }

      // El siguiente turno empieza a contar desde ahora
      localStorage.setItem('pos_shift_start', new Date().toISOString());
      renderCashCut();

      showModal(
        'Turno Cerrado con Éxito',
        `El turno actual de Elena R. en Caja 1 ha sido cerrado y registrado exitosamente.\n\n• Efectivo contado: $${contadoVal.toFixed(2)}\n• Ventas totales: $${totalSalesAmount.toFixed(2)} (${totalSalesCount} ventas)\n• Efectivo esperado: $${expectedCash.toFixed(2)}\n\nEl reporte de corte ha sido generado y guardado.`
      );
    });
  }

  if (btnCutPreview) {
    btnCutPreview.addEventListener('click', () => {
      let totalSalesCount = 0;
      let totalSalesAmount = 0;
      let countCash = 0, amountCash = 0;
      let countCard = 0, amountCard = 0;
      let countTransfer = 0, amountTransfer = 0;
      let countMixed = 0, amountMixed = 0;

      salesHistoryList.forEach(item => {
        if (item.status === 'completed') {
          totalSalesCount++;
          const tot = parseFloat(item.total) || 0;
          totalSalesAmount += tot;
          const pm = (item.paymentMethod || '').toLowerCase();
          if (pm === 'cash' || pm === 'efectivo') {
            countCash++;
            amountCash += tot;
          } else if (pm === 'card' || pm === 'tarjeta') {
            countCard++;
            amountCard += tot;
          } else if (pm === 'transfer' || pm === 'codi' || pm === 'qr') {
            countTransfer++;
            amountTransfer += tot;
          } else {
            countMixed++;
            amountMixed += tot;
          }
        }
      });

      const initialFund = 1000.00;
      const expectedCash = initialFund + amountCash;
      const contado = inputEfectivoContado ? inputEfectivoContado.value : expectedCash.toFixed(2);
      const now = new Date();
      const start = getShiftStart();
      const mins = Math.max(0, Math.floor((now - start) / 60000));
      showModal(
        'Vista Previa: Comprobante de Corte',
        `========================================\n         TIENDA ABARROTES NEXUS\n         COMPROBANTE DE CORTE DE CAJA\n========================================\nCaja: Caja 1 | Cajero: Elena R.\nFecha: ${formatShortDate(now)} ${formatTime(now)}\nTurno: ${Math.floor(mins / 60)} h ${mins % 60} min (Apertura: ${formatTime(start)})\n----------------------------------------\nFondo inicial:        $${initialFund.toFixed(2)}\nVentas Totales (${totalSalesCount}):   $${totalSalesAmount.toFixed(2)}\n  - Efectivo (${countCash}):     $${amountCash.toFixed(2)}\n  - Tarjeta (${countCard}):      $${amountCard.toFixed(2)}\n  - Transf./QR (${countTransfer}):   $${amountTransfer.toFixed(2)}\n  - Mixto (${countMixed}):           $${amountMixed.toFixed(2)}\n----------------------------------------\nEfectivo esperado:    $${expectedCash.toFixed(2)}\nEfectivo contado:     $${contado}\n========================================`
      );
    });
  }

  if (btnCutCancel) {
    btnCutCancel.addEventListener('click', () => {
      window.switchView('pos');
    });
  }

  if (btnCutOtherShift) {
    btnCutOtherShift.addEventListener('click', () => {
      showModal(
        'Consultar Otro Turno',
        'Selecciona un turno anterior o de otra fecha para consultar su arqueo y detalle de ventas.'
      );
    });
  }

  if (btnCutDateSelector) {
    btnCutDateSelector.addEventListener('click', () => {
      showModal(
        'Selector de Fecha',
        `Mostrando el turno activo correspondiente a la fecha actual: Hoy, ${formatLongDate(new Date())}.`
      );
    });
  }


  // Exponer renderizador para cambios de vista o sincronización
  window.renderCashCut = renderCashCut;
}

window.initCutCash = initCutCash;
