/**
 * MÓDULO: HISTORIAL DE VENTAS (salesHistory.js)
 * Consulta de tickets, reimpresión, filtros por caja/método y cancelación con restitución de stock
 */

const salesHistoryFilter = {
  search: '',
  caja: 'all',
  payment: 'all',
  status: 'all'
};

function initSalesHistory() {
  // =========================================================================
  // 3B. ELEMENTOS DOM (HISTORIAL DE VENTAS)
  // =========================================================================
  const salesHistoryViewContainer = document.getElementById('salesHistoryViewContainer');
  const navSalesHistoryBtn = document.getElementById('navSalesHistoryBtn');
  const historySearchInput = document.getElementById('historySearchInput');
  const historyPaymentSelect = document.getElementById('historyPaymentSelect');
  const historyStatusSelect = document.getElementById('historyStatusSelect');
  const historyTableBody = document.getElementById('historyTableBody');
  const historyEmptyState = document.getElementById('historyEmptyState');
  const cajaPills = document.querySelectorAll('.caja-pills-list .pill-caja');
  const btnExportSalesHistory = document.getElementById('btnExportSalesHistory');
  const btnReprintLastTicket = document.getElementById('btnReprintLastTicket');

  // Modal Ticket Detail
  const modalTicketDetail = document.getElementById('modalTicketDetail');
  const ticketModalFolio = document.getElementById('ticketModalFolio');
  const ticketModalDate = document.getElementById('ticketModalDate');
  const ticketReceiptBody = document.getElementById('ticketReceiptBody');
  const btnCloseTicketModal = document.getElementById('btnCloseTicketModal');
  const btnCloseTicketModalBottom = document.getElementById('btnCloseTicketModalBottom');
  const btnPrintTicketModal = document.getElementById('btnPrintTicketModal');


  // =========================================================================
  // 7. CONTROLADOR DE HISTORIAL DE VENTAS
  // =========================================================================
  function updateSalesHistoryKPIs() {
    let totalTicketsNum = 0;
    let totalAccumulatedNum = 0;
    let totalCashNum = 0;

    salesHistoryList.forEach(item => {
      if (item.status === 'completed') {
        totalTicketsNum++;
        const total = parseFloat(item.total) || 0;
        totalAccumulatedNum += total;
        const pm = (item.paymentMethod || '').toLowerCase();
        if (pm === 'cash' || pm === 'efectivo') {
          totalCashNum += total;
        }
      }
    });

    const avgTicketNum = totalTicketsNum > 0 ? (totalAccumulatedNum / totalTicketsNum) : 0;

    const kpiTicketsCount = document.getElementById('kpiTicketsCount');
    const kpiAvgTicket = document.getElementById('kpiAvgTicket');
    const kpiCashInBox = document.getElementById('kpiCashInBox');
    const footerTicketsTotal = document.getElementById('footerTicketsTotal');
    const footerAccumulatedAmount = document.getElementById('footerAccumulatedAmount');

    if (kpiTicketsCount) kpiTicketsCount.textContent = totalTicketsNum.toLocaleString('es-MX');
    if (kpiAvgTicket) kpiAvgTicket.textContent = `${avgTicketNum.toFixed(2)}`;
    if (kpiCashInBox) kpiCashInBox.textContent = `${totalCashNum.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (footerTicketsTotal) footerTicketsTotal.textContent = totalTicketsNum.toLocaleString('es-MX');
    if (footerAccumulatedAmount) footerAccumulatedAmount.textContent = `${totalAccumulatedNum.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const kpiHistorySalesTotal = document.getElementById('kpiHistorySalesTotal');
    const kpiHistoryTicketsCount = document.getElementById('kpiHistoryTicketsCount');
    const kpiHistoryAvgTicket = document.getElementById('kpiHistoryAvgTicket');
    if (kpiHistorySalesTotal) kpiHistorySalesTotal.textContent = `$${totalAccumulatedNum.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (kpiHistoryTicketsCount) kpiHistoryTicketsCount.textContent = totalTicketsNum.toLocaleString('es-MX');
    if (kpiHistoryAvgTicket) kpiHistoryAvgTicket.textContent = `$${avgTicketNum.toFixed(2)}`;
  }

  function getPaymentBadgeHtml(method) {
    switch (method) {
      case 'cash':
        return `<span class="badge-pay-method badge-pay-cash"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2"></circle><path d="M6 12h.01M18 12h.01"></path></svg>Efectivo</span>`;
      case 'qr':
        return `<span class="badge-pay-method badge-pay-qr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>Pago QR</span>`;
      case 'card':
        return `<span class="badge-pay-method badge-pay-card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>Tarjeta</span>`;
      case 'codi':
      default:
        return `<span class="badge-pay-method badge-pay-codi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>CoDi</span>`;
    }
  }

  function openTicketModal(ticket) {
    if (!ticket) return;
    if (ticketModalFolio) ticketModalFolio.textContent = 'Ticket de Compra';
    if (ticketModalDate) ticketModalDate.textContent = '';

    if (ticketReceiptBody) {
      const isCancelled = ticket.status === 'cancelled';

      let itemsListHtml = '';
      if (Array.isArray(ticket.items) && ticket.items.length > 0) {
        itemsListHtml = ticket.items.map(item => `
          <div class="receipt-item-row">
            <div class="receipt-item-info">
              <span class="receipt-item-qty">${item.quantity}x</span>
              <span class="receipt-item-name">${item.name}</span>
            </div>
            <span class="receipt-item-price">$${((item.unitPrice || item.price || 0) * item.quantity).toFixed(2)}</span>
          </div>
        `).join('');
      } else if (ticket.itemsDetail) {
        const parts = ticket.itemsDetail.split(', ');
        itemsListHtml = parts.map(part => {
          const match = part.match(/(.+?)\s+x(\d+)$/i);
          if (match) {
            return `
              <div class="receipt-item-row">
                <div class="receipt-item-info">
                  <span class="receipt-item-qty">${match[2]}x</span>
                  <span class="receipt-item-name">${match[1].trim()}</span>
                </div>
              </div>
            `;
          }
          return `
            <div class="receipt-item-row">
              <div class="receipt-item-info">
                <span class="receipt-item-qty">1x</span>
                <span class="receipt-item-name">${part.trim()}</span>
              </div>
            </div>
          `;
        }).join('');
      } else {
        itemsListHtml = `
          <div class="receipt-item-row">
            <div class="receipt-item-info">
              <span class="receipt-item-qty">${ticket.itemsCount || 1}x</span>
              <span class="receipt-item-name">${ticket.itemsSummary || 'Artículos varios'}</span>
            </div>
          </div>
        `;
      }

      const paymentNames = {
        cash: 'Efectivo',
        card: 'Tarjeta Bancaria',
        qr: 'Pago con QR',
        codi: 'CoDi'
      };
      const payName = paymentNames[ticket.paymentMethod] || 'Efectivo';
      const purchaseTime = ticket.date || `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hrs`;

      ticketReceiptBody.innerHTML = `
        <div class="receipt-time-row">
          <span class="receipt-time-label">Hora de compra:</span>
          <strong class="receipt-time-val">${purchaseTime}</strong>
        </div>
        <div class="receipt-divider"></div>
        <div class="receipt-items-container">
          ${itemsListHtml}
        </div>
        <div class="receipt-divider"></div>
        <div class="receipt-line">
          <span>Método de pago:</span>
          <strong>${payName}</strong>
        </div>
        <div class="receipt-line receipt-total">
          <span>TOTAL:</span>
          <span>$${parseFloat(ticket.total).toFixed(2)}</span>
        </div>
        ${isCancelled ? '<div style="text-align:center;color:#ef4444;font-size:11.5px;margin-top:6px;">Ticket registrado como cancelado / merma</div>' : ''}
      `;
    }

    if (modalTicketDetail) {
      modalTicketDetail.style.display = 'flex';
    }
  }

  function renderSalesHistory() {
    updateSalesHistoryKPIs();
    if (!historyTableBody) return;

    historyTableBody.innerHTML = '';

    const filtered = salesHistoryList.filter(item => {
      // Filtro de texto
      if (salesHistoryFilter.search) {
        const q = salesHistoryFilter.search.toLowerCase();
        const matchFolio = (item.folio || '').toLowerCase().includes(q);
        const matchCashier = (item.cashier || '').toLowerCase().includes(q);
        const matchCaja = (item.cajaName || '').toLowerCase().includes(q);
        const matchDetail = (item.itemsDetail || '').toLowerCase().includes(q);
        const matchSummary = (item.itemsSummary || '').toLowerCase().includes(q);
        if (!matchFolio && !matchCashier && !matchCaja && !matchDetail && !matchSummary) return false;
      }

      // Filtro de caja
      if (salesHistoryFilter.caja === 'caja1' && item.cajaCode !== 'C1') return false;
      if (salesHistoryFilter.caja === 'caja2' && item.cajaCode !== 'C2') return false;

      // Filtro de método de pago
      if (salesHistoryFilter.payment !== 'all' && item.paymentMethod !== salesHistoryFilter.payment) {
        return false;
      }

      // Filtro de estado
      if (salesHistoryFilter.status !== 'all' && item.status !== salesHistoryFilter.status) {
        return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      if (historyEmptyState) historyEmptyState.style.display = 'flex';
    } else {
      if (historyEmptyState) historyEmptyState.style.display = 'none';
    }

    filtered.forEach(item => {
      const tr = document.createElement('tr');
      const isCancelled = item.status === 'cancelled';
      const statusBadge = isCancelled
        ? `<span class="badge-status badge-status-cancelled"><span class="dot-status"></span>Cancelado</span>`
        : `<span class="badge-status badge-status-completed"><span class="dot-status"></span>Completado</span>`;

      const paymentBadge = getPaymentBadgeHtml(item.paymentMethod);
      const isC2 = item.cajaCode === 'C2';
      const totalDisplay = isCancelled
        ? `<span class="cell-total-amount" style="color: #ef4444;">($${parseFloat(item.total).toFixed(2)})</span>`
        : `<span class="cell-total-amount">$${parseFloat(item.total).toFixed(2)}</span>`;

      tr.innerHTML = `
        <td>
          <a href="javascript:void(0)" class="ticket-folio-link" data-id="${item.id}" style="color: #2563eb; font-weight: 700; text-decoration: none;">
            ${item.folio}
          </a>
        </td>
        <td>
          <div style="display: flex; flex-direction: column;">
            <span style="font-weight: 600; color: #0f172a; font-size: 13px;">${item.date}</span>
            <span style="font-size: 11px; color: #64748b;">${item.timeAgo || 'Hoy'}</span>
          </div>
        </td>
        <td>
          <div class="cell-cashier">
            <span class="badge-cashier-circle ${isC2 ? 'badge-c2' : 'badge-c1'}">${item.cajaCode || 'C1'}</span>
            <div class="cashier-info">
              <span class="cashier-box-name">${item.cajaName || 'Caja 1'}</span>
              <span class="cashier-person-name">${item.cashier || 'Elena R.'}</span>
            </div>
          </div>
        </td>
        <td>
          <div class="cell-items">
            <span class="items-main-count">${item.itemsSummary || (item.itemsCount + ' productos')}</span>
            <span class="items-list-preview" title="${item.itemsDetail || ''}">${item.itemsDetail || ''}</span>
          </div>
        </td>
        <td>
          ${paymentBadge}
        </td>
        <td>
          ${totalDisplay}
        </td>
        <td>
          ${statusBadge}
        </td>
        <td style="text-align: center; white-space: nowrap;">
          <button type="button" class="btn-history-action btn-view-ticket" data-id="${item.id}" title="Ver detalle del ticket">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px;">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span>Ver</span>
          </button>
          ${!isCancelled ? `
          <button type="button" class="btn-history-action btn-history-cancel-ticket" data-folio="${item.folio}" title="Cancelar ticket con autorización PIN">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px;">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <span>Cancelar</span>
          </button>` : ''}
        </td>
      `;

      // Eventos para ver ticket
      const folioLink = tr.querySelector('.ticket-folio-link');
      if (folioLink) {
        folioLink.addEventListener('click', (e) => {
          e.preventDefault();
          openTicketModal(item);
        });
      }

      const viewBtn = tr.querySelector('.btn-view-ticket');
      if (viewBtn) {
        viewBtn.addEventListener('click', () => {
          openTicketModal(item);
        });
      }

      const cancelBtn = tr.querySelector('.btn-history-cancel-ticket');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleCancelSaleTicket(item);
        });
      }

      historyTableBody.appendChild(tr);
    });
  }

  window.renderSalesHistory = renderSalesHistory;

  // Listeners de filtros de Historial de Ventas
  if (historySearchInput) {
    historySearchInput.addEventListener('input', (e) => {
      salesHistoryFilter.search = e.target.value.trim();
      renderSalesHistory();
    });
  }

  cajaPills.forEach(pill => {
    pill.addEventListener('click', () => {
      cajaPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      salesHistoryFilter.caja = pill.dataset.caja;
      renderSalesHistory();
    });
  });

  if (historyPaymentSelect) {
    historyPaymentSelect.addEventListener('change', (e) => {
      salesHistoryFilter.payment = e.target.value;
      renderSalesHistory();
    });
  }

  if (historyStatusSelect) {
    historyStatusSelect.addEventListener('change', (e) => {
      salesHistoryFilter.status = e.target.value;
      renderSalesHistory();
    });
  }

  if (btnExportSalesHistory) {
    btnExportSalesHistory.addEventListener('click', () => {
      if (salesHistoryList.length === 0) {
        showModal('Historial Vacío', 'No hay registros de ventas para exportar.');
        return;
      }
      const headers = ['Folio', 'Fecha/Hora', 'Caja', 'Cajero', 'Artículos', 'Método de Pago', 'Total', 'Estado'];
      const rows = salesHistoryList.map(t => [
        `"${t.folio}"`,
        `"${t.date} (${t.timeAgo || ''})"`,
        `"${t.cajaName}"`,
        `"${t.cashier}"`,
        `"${(t.itemsDetail || t.itemsSummary).replace(/"/g, '""')}"`,
        `"${t.paymentMethod}"`,
        t.total.toFixed(2),
        `"${t.status}"`
      ]);
      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `reporte_ventas_nexus_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  if (btnReprintLastTicket) {
    btnReprintLastTicket.addEventListener('click', () => {
      const lastTicket = salesHistoryList.find(t => t.status === 'completed') || salesHistoryList[0];
      if (lastTicket) {
        openTicketModal(lastTicket);
      } else {
        showModal('Sin Tickets', 'No hay tickets en el historial para reimprimir.');
      }
    });
  }

  if (btnCloseTicketModal) {
    btnCloseTicketModal.addEventListener('click', () => {
      if (modalTicketDetail) modalTicketDetail.style.display = 'none';
    });
  }

  if (btnCloseTicketModalBottom) {
    btnCloseTicketModalBottom.addEventListener('click', () => {
      if (modalTicketDetail) modalTicketDetail.style.display = 'none';
    });
  }

  if (btnPrintTicketModal) {
    btnPrintTicketModal.addEventListener('click', () => {
      window.print();
    });
  }

  if (modalTicketDetail) {
    modalTicketDetail.addEventListener('click', (e) => {
      if (e.target === modalTicketDetail) {
        modalTicketDetail.style.display = 'none';
      }
    });
  }


  // =========================================================================
  // CONTROLADOR DE CANCELACIÓN DE TICKETS DE VENTA CON RESTITUCIÓN DE STOCK
  // =========================================================================
  function handleCancelSaleTicket(ticketItem) {
    if (!ticketItem) return;
    const pin = prompt('Se requiere autorización gerencial para cancelar el ticket.\nIngresa el PIN de Administrador (por defecto: 1234):');
    if (pin !== '1234') {
      if (pin !== null) alert('PIN incorrecto. Operación denegada por seguridad.');
      return;
    }

    const reason = prompt('Motivo de cancelación de la venta:', 'Devolución de mercancía por cliente');
    if (reason === null) return;

    // Actualizar estado en Supabase / PosDataService
    if (dataService && typeof dataService.cancelSale === 'function') {
      dataService.cancelSale(ticketItem.folio, 'Elena R.');
    }

    // Actualizar estado local
    ticketItem.status = 'cancelled';

    // Restituir productos al inventario
    if (ticketItem.items && Array.isArray(ticketItem.items)) {
      ticketItem.items.forEach(sold => {
        const prod = inventoryList.find(p => p.id === sold.id || p.barcode === sold.barcode || p.barcode === sold.sku);
        if (prod) {
          prod.stock += (sold.quantity || 1);
        }
      });
      dataService.saveInventoryProducts(inventoryList);
      renderInventory();
    }

    renderSalesHistory();
    if (typeof renderCashCut === 'function') {
      renderCashCut();
    }
    showModal('Ticket Cancelado', `El ticket ${ticketItem.folio} ha sido cancelado con éxito.\n\n• Motivo: ${reason}\n• Unidades devueltas al inventario.\n• Registrado en auditoría de caja.`);
  }


  // Exponer funciones en window
  window.updateSalesHistoryKPIs = updateSalesHistoryKPIs;
  window.getPaymentBadgeHtml = getPaymentBadgeHtml;
  window.openTicketModal = openTicketModal;
  window.renderSalesHistory = renderSalesHistory;
  window.handleCancelSaleTicket = handleCancelSaleTicket;
}

window.initSalesHistory = initSalesHistory;
