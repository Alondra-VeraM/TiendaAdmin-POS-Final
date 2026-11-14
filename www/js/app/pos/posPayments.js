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
      if (typeof window.checkShiftState === 'function') window.checkShiftState();
      if (typeof window.openNewShiftModal === 'function') {
        window.openNewShiftModal();
      } else {
        showModal(
          'Apertura de Caja Requerida',
          `La ${terminalInfo.name} (${terminalInfo.code}) se encuentra CERRADA.\n\n` +
          `Debe realizar la Apertura de Caja e ingresar el fondo inicial para comenzar a vender.`
        );
      }
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

    // Generar folio único garantizado cronológicamente por terminal para evitar colisiones
    const cashierName = (window.currentSessionUser && window.currentSessionUser.name) || 'Elena R.';
    const nextFolioStr = (typeof window.generateUniqueFolio === 'function')
      ? window.generateUniqueFolio(terminalInfo.code)
      : `#TK-${terminalInfo.code}-${Date.now()}`;

    state.folio = nextFolioStr;

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
    let res = null;
    try {
      res = await window.PosDataService.registerSale(salePayload, state.cart);
    } catch (checkoutErr) {
      console.error('[CHECKOUT NETWORK ERROR]', checkoutErr);
      res = { success: false, error: 'Error de red o comunicación: ' + checkoutErr.message };
    }

    isCheckoutInProgress = false;
    if (btnCheckout) {
      btnCheckout.disabled = false;
      const checkoutText = document.getElementById('checkoutBtnLabel');
      if (checkoutText) checkoutText.textContent = `Cobrar $${totals.totalNet.toFixed(2)}`;
    }

    // VERIFICACIÓN ESTRICTA: No simular éxito ni mostrar ticket si Supabase no confirmó la inserción real
    if (!res || res.success !== true || !res.result || res.result.ok !== true || res.duplicate === true) {
      console.error('[ERROR EN FLUJO DE COBRO - VENTA RECHAZADA POR SUPABASE]:', res);

      // El carrito se mantiene intacto; NO se muestra ticket
      let errMsg = res?.error || res?.result?.error || 'No se pudo guardar la venta en Supabase. Compruebe la conexión.';
      if (res?.errorCode === 'SHIFT_CLOSED') {
        showModal('Venta Bloqueada: Caja Cerrada', errMsg + '\n\nDebe realizar la apertura de caja para vender.');
        if (typeof window.checkShiftState === 'function') window.checkShiftState();
      } else if (res?.errorCode === 'INSUFFICIENT_STOCK') {
        showModal('Inventario Insuficiente', `${errMsg}\n\nEl inventario ha sido actualizado desde el servidor.`);
        if (typeof window.refreshInventoryFromSupabase === 'function') window.refreshInventoryFromSupabase();
      } else if (res?.errorCode === 'DUPLICATE_FOLIO' || res?.duplicate === true) {
        showModal('Folio Duplicado', 'El identificador de venta ya existía. Se ha generado un nuevo folio para reintentar.');
        state.folio = (typeof window.generateUniqueFolio === 'function') ? window.generateUniqueFolio(terminalInfo.code) : `#TK-${terminalInfo.code}-${Date.now()}`;
      } else {
        showModal('Error al Guardar Venta en Supabase', errMsg + '\n\nLos productos permanecen en el carrito para que pueda reintentar.');
      }
      return;
    }

    // 4. VENTA EXITOSA CONFIRMADA POR SUPABASE: Registrar en historial local y refrescar vistas
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
      id: res.result.sale_id,
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

    // Mostrar comprobante / ticket ÚNICAMENTE tras confirmación de Supabase
    if (typeof openTicketModal === 'function') {
      openTicketModal(newHistoryEntry);
    }

    // Limpiar carrito para la siguiente venta
    state.cart = [];
    if (typeof renderCart === 'function') renderCart();

    // Generar nuevo folio fresco para la siguiente venta
    state.folio = (typeof window.generateUniqueFolio === 'function')
      ? window.generateUniqueFolio(terminalInfo.code)
      : `#TK-${terminalInfo.code}-${Date.now()}`;

    // Sincronización integral inmediata de todas las pantallas con Supabase (ERROR 4)
    if (typeof window.syncAllPosScreens === 'function') {
      await window.syncAllPosScreens();
    } else {
      if (typeof window.refreshInventoryFromSupabase === 'function') await window.refreshInventoryFromSupabase();
      if (typeof window.refreshSalesFromSupabase === 'function') await window.refreshSalesFromSupabase();
    }
  }

  if (btnCheckout) {
    btnCheckout.addEventListener('click', triggerCheckout);
  }

  window.triggerCheckout = triggerCheckout;
  window.updateCashChange = updateCashChange;
}

window.initPosPayments = initPosPayments;
