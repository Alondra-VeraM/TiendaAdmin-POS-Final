/**
 * SUBMÓDULO POS: MÉTODOS DE PAGO Y CÁLCULO DEL CAMBIO (posPayments.js)
 * Efectivo, tarjeta, transferencia, crédito, botones de billetes, cálculo de cambio y proceso de cobro
 */

function initPosPayments() {
  const cashCalculator = document.getElementById('cashCalculator');
  const cashReceivedInput = document.getElementById('cashReceivedInput');
  const changeAmount = document.getElementById('changeAmount');
  const btnCheckout = document.getElementById('btnCheckout');

  function updateCashChange() {
    if (!cashReceivedInput || !changeAmount) return;
    const totals = calculateTotals();
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
      } else {
        if (cashCalculator) cashCalculator.style.display = 'none';
      }
    });
  });

  const billButtons = document.querySelectorAll('.btn-bill');
  billButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const totals = calculateTotals();
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

  async function triggerCheckout() {
    const totals = calculateTotals();
    if (totals.totalPieces === 0) {
      showModal('Ticket Vacío', 'No hay artículos en la venta actual para cobrar.');
      return;
    }

    const salePayload = {
      folio: state.folio,
      total_items: totals.totalProducts,
      total_pieces: totals.totalPieces,
      subtotal: totals.subtotalAccumulated,
      discount: totals.totalDiscount,
      total_net: totals.totalNet,
      payment_method: state.selectedPaymentMethod,
      created_at: new Date().toISOString()
    };

    // 1. DESCONTAR STOCK INMEDIATAMENTE EN EL INVENTARIO LOCAL
    state.cart.forEach(cartItem => {
      const prod = inventoryList.find(p => 
        (p.id != null && cartItem.id != null && String(p.id) === String(cartItem.id)) ||
        (p.barcode && cartItem.barcode && String(p.barcode).trim() === String(cartItem.barcode).trim()) ||
        (p.sku && cartItem.sku && String(p.sku).trim() === String(cartItem.sku).trim())
      );
      if (prod) {
        prod.stock = Math.max(0, (parseInt(prod.stock, 10) || 0) - (parseInt(cartItem.quantity, 10) || 1));
      }
    });

    // 2. Guardar nuevo stock y refrescar vista de inventario
    if (dataService && typeof dataService.saveInventoryProducts === 'function') {
      dataService.saveInventoryProducts(inventoryList);
    }
    if (typeof renderInventory === 'function') {
      renderInventory();
    }

    // 3. Registrar venta en base de datos local y persistir
    await dataService.registerSale(salePayload, state.cart);

    // 4. Registrar en Historial de Ventas dinámicamente
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} hrs`;
    const itemsDesc = state.cart.map(c => `${c.name} x${c.quantity}`).join(', ');
    const cartSnapshot = state.cart.map(c => ({
      name: c.name,
      quantity: c.quantity,
      unitPrice: c.unitPrice || c.price || 0,
      total: (c.unitPrice || c.price || 0) * c.quantity
    }));
    const nextHistFolio = state.folio.startsWith('#') ? state.folio : ('#' + state.folio);
    const newHistoryEntry = {
      id: Date.now(),
      folio: nextHistFolio,
      date: timeStr,
      created_at: now.toISOString(),
      timeAgo: 'Hace un momento',
      cajaCode: 'C1',
      cajaName: 'Caja 1',
      cashier: 'Elena R.',
      itemsCount: totals.totalPieces,
      itemsSummary: `${totals.totalPieces} producto${totals.totalPieces > 1 ? 's' : ''}`,
      itemsDetail: itemsDesc,
      items: cartSnapshot,
      paymentMethod: state.selectedPaymentMethod,
      total: totals.totalNet,
      status: 'completed'
    };
    salesHistoryList.unshift(newHistoryEntry);
    if (dataService.saveSalesHistory) {
      dataService.saveSalesHistory(salesHistoryList);
    }
    if (typeof renderSalesHistory === 'function') {
      renderSalesHistory();
    }
    if (typeof renderCashCut === 'function') {
      renderCashCut();
    }

    // Mostrar el ticket limpio automáticamente al cobrar
    openTicketModal(newHistoryEntry);

    // Limpiar carrito para la siguiente venta
    state.cart = [];
    renderCart();

    const nextFolioNum = parseInt(state.folio.replace('#', '')) + 1;
    state.folio = `#${nextFolioNum}`;
    const folioBadge = document.getElementById('ticketFolio');
    if (folioBadge) folioBadge.textContent = `Folio ${state.folio}`;
  }

  if (btnCheckout) {
    btnCheckout.addEventListener('click', triggerCheckout);
  }


  // Exponer funciones en window
  window.updateCashChange = updateCashChange;
  window.triggerCheckout = triggerCheckout;
}

window.initPosPayments = initPosPayments;
