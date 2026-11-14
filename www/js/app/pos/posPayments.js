/**
 * SUBMÓDULO POS: MÉTODOS DE PAGO Y CÁLCULO DEL CAMBIO (posPayments.js)
 * Efectivo, tarjeta (Mercado Pago Point Smart 2), transferencia, pago mixto y cobro atómico con Supabase.
 */

function initPosPayments() {
  const cashCalculator = document.getElementById('cashCalculator');
  const mixedCalculator = document.getElementById('mixedCalculator');
  const cashReceivedInput = document.getElementById('cashReceivedInput');
  const changeAmount = document.getElementById('changeAmount');
  const btnCheckout = document.getElementById('btnCheckout');

  function updateCashChange() {
    if (!cashReceivedInput || !changeAmount) return;
    const totals = typeof calculateTotals === 'function' ? calculateTotals() : { totalNet: 0 };
    const received = parseFloat(cashReceivedInput.value) || 0;
    const change = Math.max(0, received - totals.totalNet);
    changeAmount.textContent = `$${change.toFixed(2)}`;
  }

  const paymentButtons = document.querySelectorAll('.payment-btn');
  paymentButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      paymentButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedPaymentMethod = btn.dataset.method;

      if (state.selectedPaymentMethod === 'cash') {
        if (cashCalculator) cashCalculator.style.display = 'block';
        if (mixedCalculator) mixedCalculator.style.display = 'none';
      } else if (state.selectedPaymentMethod === 'mixed') {
        if (cashCalculator) cashCalculator.style.display = 'none';
        if (mixedCalculator) {
          mixedCalculator.style.display = 'block';
          const totals = typeof calculateTotals === 'function' ? calculateTotals() : { totalNet: 0 };
          const mixedCash = document.getElementById('mixedCashInput');
          const mixedCard = document.getElementById('mixedCardInput');
          const mixedTransfer = document.getElementById('mixedTransferInput');
          if (mixedCash && (!mixedCash.value || parseFloat(mixedCash.value) === 0)) {
            mixedCash.value = (totals.totalNet / 2).toFixed(2);
          }
          if (mixedCard && (!mixedCard.value || parseFloat(mixedCard.value) === 0)) {
            mixedCard.value = (totals.totalNet - (parseFloat(mixedCash?.value) || 0)).toFixed(2);
          }
          if (mixedTransfer && !mixedTransfer.value) mixedTransfer.value = '0.00';
          updateMixedTotalCheck();
        }
      } else {
        if (cashCalculator) cashCalculator.style.display = 'none';
        if (mixedCalculator) mixedCalculator.style.display = 'none';
      }
    });
  });

  // Cálculo para pagos mixtos
  function updateMixedTotalCheck() {
    const totals = typeof calculateTotals === 'function' ? calculateTotals() : { totalNet: 0 };
    const mixedCash = parseFloat(document.getElementById('mixedCashInput')?.value || 0);
    const mixedCard = parseFloat(document.getElementById('mixedCardInput')?.value || 0);
    const mixedTransfer = parseFloat(document.getElementById('mixedTransferInput')?.value || 0);
    const sum = mixedCash + mixedCard + mixedTransfer;
    const diff = totals.totalNet - sum;

    const mixedStatus = document.getElementById('mixedStatusMsg');
    if (mixedStatus) {
      if (Math.abs(diff) < 0.01) {
        mixedStatus.textContent = `✓ Montos coinciden exactamente ($${sum.toFixed(2)})`;
        mixedStatus.style.color = '#10b981';
      } else if (diff > 0) {
        mixedStatus.textContent = `Faltan $${diff.toFixed(2)} por cubrir (Total: $${totals.totalNet.toFixed(2)})`;
        mixedStatus.style.color = '#ef4444';
      } else {
        mixedStatus.textContent = `Excedente de $${Math.abs(diff).toFixed(2)} (Total: $${totals.totalNet.toFixed(2)})`;
        mixedStatus.style.color = '#f59e0b';
      }
    }
  }

  const mixedInputs = ['mixedCashInput', 'mixedCardInput', 'mixedTransferInput'];
  mixedInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateMixedTotalCheck);
  });

  const billButtons = document.querySelectorAll('.btn-bill');
  billButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const totals = typeof calculateTotals === 'function' ? calculateTotals() : { totalNet: 0 };
      const val = btn.dataset.amount;
      if (val === 'exact') {
        cashReceivedInput.value = totals.totalNet.toFixed(2);
      } else {
        cashReceivedInput.value = parseFloat(val).toFixed(2);
      }
      updateCashChange();
    });
  });

  if (cashReceivedInput) {
    cashReceivedInput.addEventListener('input', updateCashChange);
  }

  // Ejecución segura de cobro
  let isCheckoutInProgress = false;

  async function triggerCheckout() {
    if (isCheckoutInProgress) return;

    const totals = typeof calculateTotals === 'function' ? calculateTotals() : { totalPieces: 0, totalNet: 0 };
    if (totals.totalPieces === 0) {
      showModal('Ticket Vacío', 'No hay artículos en la venta actual para cobrar.');
      return;
    }

    // 1. VALIDACIÓN OBLIGATORIA: Verificar si la terminal tiene un turno abierto
    const terminalInfo = typeof window.getActiveTerminal === 'function' ? window.getActiveTerminal() : { code: 'C1', name: 'Caja 1' };
    const shiftData = await window.PosDataService.getTerminalShift(terminalInfo.code);

    if (!shiftData || !shiftData.is_open) {
      showModal(
        'Caja Cerrada - Ventas Bloqueadas',
        `La ${terminalInfo.name} (${terminalInfo.code}) se encuentra actualmente CERRADA.\n\n` +
        `No se pueden registrar ventas hasta que se abra un nuevo turno.\n` +
        `Por favor, abre un turno desde el botón "Abrir Turno" para comenzar a vender.`
      );
      if (typeof window.checkShiftState === 'function') window.checkShiftState();
      return;
    }

    // 2. Manejo de métodos de pago
    let cashAmount = 0;
    let cardAmount = 0;
    let transferAmount = 0;
    let cashReceived = null;
    let cashChange = null;

    if (state.selectedPaymentMethod === 'cash') {
      cashAmount = totals.totalNet;
      cashReceived = parseFloat(cashReceivedInput?.value || totals.totalNet);
      cashChange = Math.max(0, cashReceived - totals.totalNet);
      if (cashReceived < totals.totalNet) {
        showModal('Efectivo Insuficiente', `El efectivo recibido ($${cashReceived.toFixed(2)}) es menor al total a pagar ($${totals.totalNet.toFixed(2)}).`);
        return;
      }
    } else if (state.selectedPaymentMethod === 'card') {
      cardAmount = totals.totalNet;
      // Cobro manual mediante Mercado Pago Point Smart 2
    } else if (state.selectedPaymentMethod === 'transfer') {
      transferAmount = totals.totalNet;
      // Cobro manual mediante transferencia verificada
    } else if (state.selectedPaymentMethod === 'mixed') {
      const mixedCash = parseFloat(document.getElementById('mixedCashInput')?.value || 0);
      const mixedCard = parseFloat(document.getElementById('mixedCardInput')?.value || 0);
      const mixedTransfer = parseFloat(document.getElementById('mixedTransferInput')?.value || 0);
      const sum = mixedCash + mixedCard + mixedTransfer;

      if (Math.abs(sum - totals.totalNet) > 0.05) {
        showModal('Pago Mixto Incompleto', `La suma de los métodos ($${sum.toFixed(2)}) debe coincidir con el total neto ($${totals.totalNet.toFixed(2)}).`);
        return;
      }
      cashAmount = mixedCash;
      cardAmount = mixedCard;
      transferAmount = mixedTransfer;
    }

    // Generar identificador único (idempotency folio)
    const cashierName = (window.currentSessionUser && window.currentSessionUser.name) || 'Elena R.';
    const nextFolioStr = state.folio || `#TK-${terminalInfo.code}-${Date.now().toString().slice(-6)}`;

    const salePayload = {
      folio: nextFolioStr,
      terminal_code: terminalInfo.code,
      terminal_name: terminalInfo.name,
      cashier_name: cashierName,
      total_items: totals.totalProducts,
      total_pieces: totals.totalPieces,
      subtotal: totals.subtotalAccumulated,
      discount: totals.totalDiscount,
      total_net: totals.totalNet,
      payment_method: state.selectedPaymentMethod,
      cash_received: cashReceived,
      cash_change: cashChange,
      cash_amount: cashAmount,
      card_amount: cardAmount,
      transfer_amount: transferAmount,
      created_at: new Date().toISOString()
    };

    isCheckoutInProgress = true;
    if (btnCheckout) {
      btnCheckout.disabled = true;
      const checkoutText = document.getElementById('checkoutBtnLabel');
      if (checkoutText) checkoutText.textContent = 'Procesando en Supabase...';
    }

    // 3. REGISTRAR VENTA ATÓMICAMENTE EN SUPABASE
    const res = await window.PosDataService.registerSale(salePayload, state.cart);

    isCheckoutInProgress = false;
    if (btnCheckout) {
      btnCheckout.disabled = false;
      const checkoutText = document.getElementById('checkoutBtnLabel');
      if (checkoutText) checkoutText.textContent = `Cobrar $${totals.totalNet.toFixed(2)}`;
    }

    if (!res || !res.success) {
      // Manejo claro de errores de persistencia o stock
      if (res?.errorCode === 'SHIFT_CLOSED') {
        showModal('Venta Bloqueada: Caja Cerrada', res.error || 'La caja está cerrada. Abra un nuevo turno.');
        if (typeof window.checkShiftState === 'function') window.checkShiftState();
      } else if (res?.errorCode === 'INSUFFICIENT_STOCK') {
        showModal('Inventario Insuficiente', `${res.error}\n\nOtro dispositivo o venta actualizó las existencias. El inventario ha sido actualizado.`);
        if (typeof window.refreshInventoryFromSupabase === 'function') window.refreshInventoryFromSupabase();
      } else {
        showModal('Error al Guardar Venta', res?.error || 'No se pudo guardar la venta en Supabase. Compruebe la conexión.');
      }
      return;
    }

    // 4. VENTA EXITOSA: Registrar en historial local y refrescar vistas
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())} hrs`;
    const itemsDesc = state.cart.map(c => `${c.name} x${c.quantity}`).join(', ');
    const cartSnapshot = state.cart.map(c => ({
      name: c.name,
      quantity: c.quantity,
      unitPrice: c.unitPrice || c.price || 0,
      total: (c.unitPrice || c.price || 0) * c.quantity
    }));

    const newHistoryEntry = {
      id: res.result?.sale_id || Date.now(),
      folio: nextFolioStr,
      date: timeStr,
      created_at: now.toISOString(),
      timeAgo: 'Hace un momento',
      cajaCode: terminalInfo.code,
      cajaName: terminalInfo.name,
      cashier: cashierName,
      itemsCount: totals.totalPieces,
      itemsSummary: `${totals.totalPieces} producto${totals.totalPieces > 1 ? 's' : ''}`,
      itemsDetail: itemsDesc,
      items: cartSnapshot,
      paymentMethod: state.selectedPaymentMethod,
      cashAmount,
      cardAmount,
      transferAmount,
      total: totals.totalNet,
      status: 'completed'
    };

    if (Array.isArray(window.salesHistoryList)) {
      window.salesHistoryList.unshift(newHistoryEntry);
      if (window.PosDataService.saveSalesHistory) {
        window.PosDataService.saveSalesHistory(window.salesHistoryList);
      }
    }

    if (typeof renderSalesHistory === 'function') renderSalesHistory();
    if (typeof renderCashCut === 'function') renderCashCut();

    // Mostrar comprobante / ticket
    if (typeof openTicketModal === 'function') {
      openTicketModal(newHistoryEntry);
    }

    // Limpiar carrito para la siguiente venta
    state.cart = [];
    if (typeof renderCart === 'function') renderCart();

    // Generar siguiente folio
    const nextNum = (parseInt(nextFolioStr.replace(/[^0-9]/g, '')) || 44940) + 1;
    state.folio = `#TK-${terminalInfo.code}-${nextNum}`;
    const folioBadge = document.getElementById('ticketFolio');
    if (folioBadge) folioBadge.textContent = `Folio ${state.folio}`;

    // Refrescar inventario y ventas desde Supabase en segundo plano
    if (typeof window.refreshInventoryFromSupabase === 'function') {
      window.refreshInventoryFromSupabase();
    }
    if (typeof window.refreshSalesFromSupabase === 'function') {
      window.refreshSalesFromSupabase();
    }
  }

  if (btnCheckout) {
    btnCheckout.addEventListener('click', triggerCheckout);
  }

  window.triggerCheckout = triggerCheckout;
  window.updateCashChange = updateCashChange;
}

window.initPosPayments = initPosPayments;
