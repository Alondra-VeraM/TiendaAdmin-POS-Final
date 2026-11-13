/**
 * MÓDULO: REPORTES DE CORTES HISTÓRICOS (reports.js)
 * Consulta de cortes de caja de varios días desde Supabase con filtros por fecha y caja.
 */

function initReports() {
  const repFilterStartDate = document.getElementById('repFilterStartDate');
  const repFilterEndDate = document.getElementById('repFilterEndDate');
  const repFilterTerminal = document.getElementById('repFilterTerminal');
  const btnRunReports = document.getElementById('btnRunReports');
  const reportsTableBody = document.getElementById('reportsTableBody');
  const reportsEmptyState = document.getElementById('reportsEmptyState');
  const reportsTableWrapper = document.getElementById('reportsTableWrapper');

  // Inicializar fechas por defecto (últimos 7 días)
  const pad = (n) => String(n).padStart(2, '0');
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const formatIsoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (repFilterEndDate && !repFilterEndDate.value) {
    repFilterEndDate.value = formatIsoDate(today);
  }
  if (repFilterStartDate && !repFilterStartDate.value) {
    repFilterStartDate.value = formatIsoDate(sevenDaysAgo);
  }

  // Presets rápidos
  const btnPresetToday = document.getElementById('btnPresetToday');
  const btnPreset7Days = document.getElementById('btnPreset7Days');
  const btnPresetMonth = document.getElementById('btnPresetMonth');

  if (btnPresetToday) {
    btnPresetToday.addEventListener('click', () => {
      if (repFilterStartDate) repFilterStartDate.value = formatIsoDate(today);
      if (repFilterEndDate) repFilterEndDate.value = formatIsoDate(today);
      loadReportsData();
    });
  }

  if (btnPreset7Days) {
    btnPreset7Days.addEventListener('click', () => {
      if (repFilterStartDate) repFilterStartDate.value = formatIsoDate(sevenDaysAgo);
      if (repFilterEndDate) repFilterEndDate.value = formatIsoDate(today);
      loadReportsData();
    });
  }

  if (btnPresetMonth) {
    btnPresetMonth.addEventListener('click', () => {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      if (repFilterStartDate) repFilterStartDate.value = formatIsoDate(firstDay);
      if (repFilterEndDate) repFilterEndDate.value = formatIsoDate(today);
      loadReportsData();
    });
  }

  async function loadReportsData() {
    const startDate = repFilterStartDate ? repFilterStartDate.value : null;
    const endDate = repFilterEndDate ? repFilterEndDate.value : null;
    const terminal = repFilterTerminal ? repFilterTerminal.value : 'all';

    if (btnRunReports) {
      btnRunReports.disabled = true;
      btnRunReports.textContent = 'Consultando...';
    }

    const res = await window.PosDataService.fetchReports(startDate, endDate, terminal);

    if (btnRunReports) {
      btnRunReports.disabled = false;
      btnRunReports.textContent = 'Consultar';
    }

    if (!res || !res.ok) {
      if (reportsEmptyState) {
        reportsEmptyState.style.display = 'block';
        reportsEmptyState.innerHTML = `
          <div style="padding: 40px 20px; text-align: center; color: #ef4444;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 48px; height: 48px; margin-bottom: 12px;">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <div style="font-weight: 600; font-size: 15px;">Error al consultar reportes</div>
            <div style="font-size: 13px; color: #64748b; margin-top: 4px;">${res?.error || 'Revisa la conexión con Supabase.'}</div>
          </div>
        `;
      }
      if (reportsTableWrapper) reportsTableWrapper.style.display = 'none';
      return;
    }

    const { cuts, totals } = res;

    // Actualizar KPI Cards
    const kpiRepTotalSales = document.getElementById('kpiRepTotalSales');
    const kpiRepCutsCount = document.getElementById('kpiRepCutsCount');
    const kpiRepTicketsCount = document.getElementById('kpiRepTicketsCount');
    const kpiRepCashSales = document.getElementById('kpiRepCashSales');
    const kpiRepCardSales = document.getElementById('kpiRepCardSales');
    const kpiRepTransferSales = document.getElementById('kpiRepTransferSales');
    const kpiRepMixedSales = document.getElementById('kpiRepMixedSales');
    const kpiRepInflows = document.getElementById('kpiRepInflows');
    const kpiRepOutflows = document.getElementById('kpiRepOutflows');
    const kpiRepCountedCash = document.getElementById('kpiRepCountedCash');

    if (kpiRepTotalSales) kpiRepTotalSales.textContent = `$${totals.totalSalesAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (kpiRepCutsCount) kpiRepCutsCount.textContent = totals.cutsCount;
    if (kpiRepTicketsCount) kpiRepTicketsCount.textContent = totals.totalSalesCount;
    if (kpiRepCashSales) kpiRepCashSales.textContent = `$${totals.totalCashSales.toFixed(2)}`;
    if (kpiRepCardSales) kpiRepCardSales.textContent = `$${totals.totalCardSales.toFixed(2)}`;
    if (kpiRepTransferSales) kpiRepTransferSales.textContent = `$${totals.totalTransferSales.toFixed(2)}`;
    if (kpiRepMixedSales) kpiRepMixedSales.textContent = `$${totals.totalMixedSales.toFixed(2)}`;
    if (kpiRepInflows) kpiRepInflows.textContent = `+$${totals.totalInflows.toFixed(2)}`;
    if (kpiRepOutflows) kpiRepOutflows.textContent = `-$${(totals.totalOutflows + totals.totalSupplier).toFixed(2)}`;
    if (kpiRepCountedCash) kpiRepCountedCash.textContent = `$${totals.totalCountedCash.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Renderizar tabla
    if (!cuts || cuts.length === 0) {
      if (reportsEmptyState) {
        reportsEmptyState.style.display = 'block';
        reportsEmptyState.innerHTML = `
          <div style="padding: 48px 20px; text-align: center; color: #94a3b8;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 52px; height: 52px; margin-bottom: 12px; opacity: 0.6;">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <div style="font-weight: 600; color: #64748b; font-size: 15px;">No se encontraron cortes de caja</div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">No hay registros para las fechas y terminal seleccionadas.</div>
          </div>
        `;
      }
      if (reportsTableWrapper) reportsTableWrapper.style.display = 'none';
      if (reportsTableBody) reportsTableBody.innerHTML = '';
      return;
    }

    if (reportsEmptyState) reportsEmptyState.style.display = 'none';
    if (reportsTableWrapper) reportsTableWrapper.style.display = 'block';
    if (!reportsTableBody) return;

    reportsTableBody.innerHTML = cuts.map(c => {
      const openDate = c.opened_at ? new Date(c.opened_at) : null;
      const closeDate = c.closed_at ? new Date(c.closed_at) : null;

      const formatDt = (d) => {
        if (!d || isNaN(d.getTime())) return '--:--';
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}h`;
      };

      const terminalBadgeClass = c.terminal_code === 'C2' ? 'badge-caja-c2' : 'badge-caja-c1';
      const statusBadge = c.status === 'open' 
        ? `<span class="badge-status-open" style="background:#ecfdf5; color:#065f46; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:700;">Abierto</span>`
        : `<span class="badge-status-closed" style="background:#f1f5f9; color:#475569; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:700;">Cerrado</span>`;

      const totAmount = parseFloat(c.total_sales_amount || 0).toFixed(2);
      const cash = parseFloat(c.cash_sales || 0).toFixed(2);
      const card = parseFloat(c.card_sales || 0).toFixed(2);
      const transf = parseFloat(c.transfer_sales || c.qr_sales || 0).toFixed(2);
      const mixed = parseFloat(c.mixed_sales || 0).toFixed(2);
      const expected = parseFloat(c.expected_cash || 0).toFixed(2);
      const counted = parseFloat(c.counted_cash || 0).toFixed(2);

      return `
        <tr class="report-cut-row" data-cut-id="${c.id}">
          <td style="font-weight: 700; color: #1e293b;">#Corte-${c.id}</td>
          <td>
            <span class="pill-caja ${terminalBadgeClass}" style="font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px;">
              ${c.terminal_name || c.terminal_code}
            </span>
          </td>
          <td style="font-size: 12px; color: #64748b;">${formatDt(openDate)}</td>
          <td style="font-size: 12px; color: #64748b;">${closeDate ? formatDt(closeDate) : '<span style="color:#10b981;font-weight:600;">En curso</span>'}</td>
          <td style="font-size: 13px; font-weight: 600; color: #334155;">${c.cashier_name || 'Cajero'}</td>
          <td style="text-align: center; font-weight: 600;">${c.total_sales_count || 0}</td>
          <td style="text-align: right; font-weight: 700; color: #0f172a; font-size: 14px;">$${totAmount}</td>
          <td style="font-size: 11px; color: #64748b; line-height: 1.4;">
            <div>Ef: <strong>$${cash}</strong> | Tq: <strong>$${card}</strong></div>
            <div>Tr: <strong>$${transf}</strong> | Mx: <strong>$${mixed}</strong></div>
          </td>
          <td style="text-align: right; font-size: 12px;">$${parseFloat(c.initial_fund || 0).toFixed(2)}</td>
          <td style="text-align: right; font-size: 12px; font-weight: 600; color: #0284c7;">$${expected}</td>
          <td style="text-align: right; font-size: 12px; font-weight: 700; color: #0f172a;">$${counted}</td>
          <td style="text-align: center;">${statusBadge}</td>
          <td style="text-align: center;">
            <button type="button" class="btn-rep-detail" onclick="window.viewCutDetail(${c.id})" style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; padding:4px 8px; font-size:12px; cursor:pointer;">
              Detalle
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  window.loadReportsData = loadReportsData;

  if (btnRunReports) {
    btnRunReports.addEventListener('click', loadReportsData);
  }

  // Modal para ver detalle completo de un corte específico
  window.viewCutDetail = async function(cutId) {
    const client = window.PosDataService.getClient();
    if (!client) return;

    try {
      const { data: cut, error } = await client.from('cash_cuts').select('*').eq('id', cutId).single();
      if (error || !cut) {
        showModal('Error', 'No se pudo obtener el detalle del corte.');
        return;
      }

      const openStr = cut.opened_at ? new Date(cut.opened_at).toLocaleString('es-MX') : '-';
      const closeStr = cut.closed_at ? new Date(cut.closed_at).toLocaleString('es-MX') : 'Turno en curso';

      showModal(
        `Detalle de Corte #Corte-${cut.id}`,
        `========================================\n` +
        `           TIENDA ABARROTES NEXUS\n` +
        `         DETALLE DE CORTE HISTÓRICO\n` +
        `========================================\n` +
        `Caja: ${cut.terminal_name} (${cut.terminal_code})\n` +
        `Cajero: ${cut.cashier_name}\n` +
        `Estado: ${cut.status.toUpperCase()}\n` +
        `Apertura: ${openStr}\n` +
        `Cierre:   ${closeStr}\n` +
        `----------------------------------------\n` +
        `Fondo Inicial:          $${parseFloat(cut.initial_fund || 0).toFixed(2)}\n` +
        `Ventas Totales (${cut.total_sales_count}):     $${parseFloat(cut.total_sales_amount || 0).toFixed(2)}\n` +
        `  - Efectivo:           $${parseFloat(cut.cash_sales || 0).toFixed(2)}\n` +
        `  - Tarjeta:            $${parseFloat(cut.card_sales || 0).toFixed(2)}\n` +
        `  - Transferencia/QR:   $${parseFloat(cut.transfer_sales || cut.qr_sales || 0).toFixed(2)}\n` +
        `  - Pagos Mixtos:       $${parseFloat(cut.mixed_sales || 0).toFixed(2)}\n` +
        `----------------------------------------\n` +
        `Entradas extraordinarias: +$${parseFloat(cut.cash_inflows || 0).toFixed(2)}\n` +
        `Salidas extraordinarias:  -$${parseFloat(cut.cash_outflows || 0).toFixed(2)}\n` +
        `Pagos a proveedores:      -$${parseFloat(cut.supplier_payouts || 0).toFixed(2)}\n` +
        `----------------------------------------\n` +
        `Efectivo Esperado:      $${parseFloat(cut.expected_cash || 0).toFixed(2)}\n` +
        `Efectivo Contado:       $${parseFloat(cut.counted_cash || 0).toFixed(2)}\n` +
        `Diferencia:             $${parseFloat(cut.difference || 0).toFixed(2)}\n` +
        `Notas: ${cut.notes || 'Sin notas registradas'}\n` +
        `========================================`
      );
    } catch (e) {
      console.warn('Error mostrando detalle corte:', e);
    }
  };
}

window.initReports = initReports;
