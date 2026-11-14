/**
 * APLICACIÓN PUNTO DE VENTA (POS) & GESTIÓN DE INVENTARIO
 * Controlador principal, orquestador de módulos, navegación y sincronización de datos
 */

// =========================================================================
// DELEGACIONES GLOBALES PARA LLAMADAS CRUZADAS ENTRE MÓDULOS
// =========================================================================
var showModal = function(title, msg) { if (window.showModal && window.showModal !== showModal) return window.showModal(title, msg); };
var renderInventory = function() { if (window.renderInventory && window.renderInventory !== renderInventory) return window.renderInventory(); };
var renderSalesHistory = function() { if (window.renderSalesHistory && window.renderSalesHistory !== renderSalesHistory) return window.renderSalesHistory(); };
var renderCashCut = function() { if (window.renderCashCut && window.renderCashCut !== renderCashCut) return window.renderCashCut(); };
var renderCart = function() { if (window.renderCart && window.renderCart !== renderCart) return window.renderCart(); };
var calculateTotals = function() { if (window.calculateTotals && window.calculateTotals !== calculateTotals) return window.calculateTotals(); };
var addProductToCart = function(p, q) { if (window.addProductToCart && window.addProductToCart !== addProductToCart) return window.addProductToCart(p, q); };
var handleProductScan = function(c) { if (window.handleProductScan && window.handleProductScan !== handleProductScan) return window.handleProductScan(c); };
var openTicketModal = function(t) { if (window.openTicketModal && window.openTicketModal !== openTicketModal) return window.openTicketModal(t); };
var triggerCheckout = function() { if (window.triggerCheckout && window.triggerCheckout !== triggerCheckout) return window.triggerCheckout(); };
var updateCashChange = function() { if (window.updateCashChange && window.updateCashChange !== updateCashChange) return window.updateCashChange(); };
var playPosScanBeep = function() { if (window.playPosScanBeep && window.playPosScanBeep !== playPosScanBeep) return window.playPosScanBeep(); };
var showPosToast = function(m) { if (window.showPosToast && window.showPosToast !== showPosToast) return window.showPosToast(m); };
var openQuickServiceModal = function(s) { if (window.openQuickServiceModal && window.openQuickServiceModal !== openQuickServiceModal) return window.openQuickServiceModal(s); };
var updateSuspendedBadge = function() { if (window.updateSuspendedBadge && window.updateSuspendedBadge !== updateSuspendedBadge) return window.updateSuspendedBadge(); };
var suspendCurrentSale = function() { if (window.suspendCurrentSale && window.suspendCurrentSale !== suspendCurrentSale) return window.suspendCurrentSale(); };
var handleInventoryBarcodeScan = function(b) { if (window.handleInventoryBarcodeScan && window.handleInventoryBarcodeScan !== handleInventoryBarcodeScan) return window.handleInventoryBarcodeScan(b); };
var isInventoryViewActive = function() { if (window.isInventoryViewActive && window.isInventoryViewActive !== isInventoryViewActive) return window.isInventoryViewActive(); };
var openShrinkageModal = function(p) { if (window.openShrinkageModal && window.openShrinkageModal !== openShrinkageModal) return window.openShrinkageModal(p); };
var getProductIconSvg = function(i) { if (window.getProductIconSvg && window.getProductIconSvg !== getProductIconSvg) return window.getProductIconSvg(i); };

// =========================================================================
// GESTIÓN DE SESIÓN Y VISTAS
// =========================================================================

// Función global de cambio de vista
window.switchView = function(viewName) {
  if (viewName !== 'pos') {
    if (window.currentSessionUser && window.currentSessionUser.role === 'cajero') {
      if (typeof window.requestAdminAuth === 'function') {
        window.requestAdminAuth(() => executeSwitchView(viewName));
        return;
      }
    }
  }
  executeSwitchView(viewName);
};

function executeSwitchView(viewName) {
  window.currentActiveView = viewName;
  if (typeof window.setAppStateView === 'function') {
    window.setAppStateView(viewName);
  }

  const posViewContainer = document.getElementById('posViewContainer');
  const inventoryViewContainer = document.getElementById('inventoryViewContainer');
  const salesHistoryViewContainer = document.getElementById('salesHistoryViewContainer');
  const cashCutViewContainer = document.getElementById('cashCutViewContainer');
  const reportsViewContainer = document.getElementById('reportsViewContainer');
  const navPosBtn = document.getElementById('navPosBtn');
  const navInventoryBtn = document.getElementById('navInventoryBtn');
  const navSalesHistoryBtn = document.getElementById('navSalesHistoryBtn');
  const navCashCutBtn = document.getElementById('navCashCutBtn');
  const navReportsBtn = document.getElementById('navReportsBtn');
  const allNavLinks = document.querySelectorAll('.sidebar-menu .nav-link');

  allNavLinks.forEach(link => {
    link.classList.remove('active');
    link.classList.remove('nav-active');
  });

  if (viewName === 'inventory') {
    if (posViewContainer) posViewContainer.style.display = 'none';
    if (salesHistoryViewContainer) salesHistoryViewContainer.style.display = 'none';
    if (cashCutViewContainer) cashCutViewContainer.style.display = 'none';
    if (reportsViewContainer) reportsViewContainer.style.display = 'none';
    if (inventoryViewContainer) inventoryViewContainer.style.display = 'flex';
    if (navInventoryBtn) navInventoryBtn.classList.add('active', 'nav-active');
    if (typeof window.renderInventory === 'function') {
      window.renderInventory();
    }
    if (typeof window.refreshInventoryFromSupabase === 'function') {
      window.refreshInventoryFromSupabase();
    }
    const invSearchInput = document.getElementById('invSearchInput');
    if (invSearchInput) invSearchInput.focus();
  } else if (viewName === 'sales-history') {
    if (posViewContainer) posViewContainer.style.display = 'none';
    if (inventoryViewContainer) inventoryViewContainer.style.display = 'none';
    if (cashCutViewContainer) cashCutViewContainer.style.display = 'none';
    if (reportsViewContainer) reportsViewContainer.style.display = 'none';
    if (salesHistoryViewContainer) salesHistoryViewContainer.style.display = 'flex';
    if (navSalesHistoryBtn) navSalesHistoryBtn.classList.add('active', 'nav-active');
    if (typeof window.renderSalesHistory === 'function') {
      window.renderSalesHistory();
    }
    if (typeof window.refreshSalesFromSupabase === 'function') {
      window.refreshSalesFromSupabase();
    }
    const historySearchInput = document.getElementById('historySearchInput');
    if (historySearchInput) historySearchInput.focus();
  } else if (viewName === 'cash-cut') {
    if (posViewContainer) posViewContainer.style.display = 'none';
    if (inventoryViewContainer) inventoryViewContainer.style.display = 'none';
    if (salesHistoryViewContainer) salesHistoryViewContainer.style.display = 'none';
    if (reportsViewContainer) reportsViewContainer.style.display = 'none';
    if (cashCutViewContainer) cashCutViewContainer.style.display = 'flex';
    if (navCashCutBtn) navCashCutBtn.classList.add('active', 'nav-active');
    if (typeof window.renderCashCut === 'function') {
      window.renderCashCut();
    }
    const inputEfectivoContado = document.getElementById('inputEfectivoContado');
    if (inputEfectivoContado) inputEfectivoContado.focus();
  } else if (viewName === 'reports') {
    if (posViewContainer) posViewContainer.style.display = 'none';
    if (inventoryViewContainer) inventoryViewContainer.style.display = 'none';
    if (salesHistoryViewContainer) salesHistoryViewContainer.style.display = 'none';
    if (cashCutViewContainer) cashCutViewContainer.style.display = 'none';
    if (reportsViewContainer) reportsViewContainer.style.display = 'flex';
    if (navReportsBtn) navReportsBtn.classList.add('active', 'nav-active');
    if (typeof window.loadReportsData === 'function') {
      window.loadReportsData();
    }
  } else {
    // POS View
    if (inventoryViewContainer) inventoryViewContainer.style.display = 'none';
    if (salesHistoryViewContainer) salesHistoryViewContainer.style.display = 'none';
    if (cashCutViewContainer) cashCutViewContainer.style.display = 'none';
    if (reportsViewContainer) reportsViewContainer.style.display = 'none';
    if (posViewContainer) posViewContainer.style.display = 'flex';
    if (navPosBtn) navPosBtn.classList.add('active');
    if (typeof window.checkShiftState === 'function') {
      window.checkShiftState();
    }
    const cartBarcodeInput = document.getElementById('cartBarcodeInput');
    if (cartBarcodeInput) cartBarcodeInput.focus();
  }
}

window.executeSwitchView = executeSwitchView;

// =========================================================================
// SERVICIO DE DATOS Y ESTADO GLOBAL COMPARTIDO
// =========================================================================

window.PosApp = window.PosApp || {};

const dataService = window.PosDataService || {
  getInventoryProducts: () => window.INITIAL_INVENTORY || [],
  saveInventoryProducts: (p) => p,
  getSalesHistory: () => window.INITIAL_SALES_HISTORY || [],
  saveSalesHistory: (s) => s,
  findProductByBarcode: async (c) => null,
  searchProducts: async (t) => [],
  registerSale: async () => ({ success: true })
};

window.PosApp.dataService = dataService;

// Listas globales compartidas
window.PosApp.inventoryList = (dataService.getInventoryProducts && dataService.getInventoryProducts()) || window.INITIAL_INVENTORY || [];
window.PosApp.salesHistoryList = (dataService.getSalesHistory && dataService.getSalesHistory()) || window.INITIAL_SALES_HISTORY || [];

// Conexión transparente para cualquier referencia global a inventoryList y salesHistoryList
Object.defineProperty(window, 'inventoryList', {
  get: () => window.PosApp.inventoryList,
  set: (val) => { window.PosApp.inventoryList = val; },
  configurable: true
});

Object.defineProperty(window, 'salesHistoryList', {
  get: () => window.PosApp.salesHistoryList,
  set: (val) => { window.PosApp.salesHistoryList = val; },
  configurable: true
});

// Sincronización asíncrona con Supabase
async function refreshInventoryFromSupabase() {
  if (dataService && typeof dataService.fetchProducts === 'function') {
    const items = await dataService.fetchProducts();
    if (items && Array.isArray(items) && items.length > 0) {
      window.PosApp.inventoryList = items;
      if (typeof window.renderInventory === 'function') window.renderInventory();
    }
  }
}
window.refreshInventoryFromSupabase = refreshInventoryFromSupabase;

// Helper de fecha en zona horaria de México
function getMexicoDateString(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(date);
  } catch (e) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
}
window.getMexicoDateString = getMexicoDateString;

async function refreshSalesFromSupabase() {
  if (dataService && typeof dataService.getDailySalesSummary === 'function') {
    const summary = await dataService.getDailySalesSummary('all');
    if (summary && summary.ok) {
      window.PosApp.dailySalesSummary = summary;
      const formattedSales = (summary.sales || []).map(s => {
        const dt = new Date(s.created_at);
        const pad = (n) => String(n).padStart(2, '0');
        const timeStr = !isNaN(dt.getTime()) ? `${pad(dt.getHours())}:${pad(dt.getMinutes())} hrs` : '--:--';
        const itemsList = Array.isArray(s.items) ? s.items : [];
        const itemsSummaryText = `${s.total_pieces || itemsList.length} producto${(s.total_pieces || itemsList.length) === 1 ? '' : 's'}`;
        const itemsDetailText = itemsList.map(it => `${it.name || it.product_name} x${it.quantity}`).join(', ');

        return {
          id: s.id,
          folio: s.folio,
          date: timeStr,
          created_at: s.created_at,
          cajaCode: s.terminal_code || 'C1',
          cajaName: s.terminal_name || (s.terminal_code === 'C2' ? 'Caja 2' : 'Caja 1'),
          cashier: s.cashier_name || 'Cajero',
          itemsCount: s.total_pieces || itemsList.length,
          itemsSummary: itemsSummaryText,
          itemsDetail: itemsDetailText,
          items: itemsList.map(it => ({
            name: it.name || it.product_name,
            quantity: it.quantity,
            unitPrice: parseFloat(it.unitPrice || it.unit_price || 0),
            total: parseFloat(it.subtotal || 0)
          })),
          paymentMethod: s.payment_method,
          cashAmount: parseFloat(s.cash_amount || 0),
          cardAmount: parseFloat(s.card_amount || 0),
          transferAmount: parseFloat(s.transfer_amount || 0),
          total: parseFloat(s.total_net || 0),
          status: s.status || 'completed'
        };
      });
      window.PosApp.salesHistoryList = formattedSales;
      if (typeof window.renderSalesHistory === 'function') window.renderSalesHistory();
      if (typeof window.renderCashCut === 'function') window.renderCashCut();
      return;
    }
  }

  if (dataService && typeof dataService.fetchSales === 'function') {
    const sales = await dataService.fetchSales();
    window.PosApp.allSalesHistory = Array.isArray(sales) ? sales : [];
    const todayMexico = getMexicoDateString();
    // Filtro estricto: El historial diario muestra ÚNICAMENTE las ventas del día actual en hora local de México
    window.PosApp.salesHistoryList = window.PosApp.allSalesHistory.filter(s => {
      if (!s || !s.created_at) return true;
      const saleDate = getMexicoDateString(new Date(s.created_at));
      return saleDate === todayMexico;
    });
    if (typeof window.renderSalesHistory === 'function') window.renderSalesHistory();
    if (typeof window.renderCashCut === 'function') window.renderCashCut();
  }
}
window.refreshSalesFromSupabase = refreshSalesFromSupabase;

// Carga inicial directa desde Supabase
refreshInventoryFromSupabase();
refreshSalesFromSupabase();

// Escuchar sincronización en tiempo real desde Supabase
window.addEventListener('supabase:data-synced', (e) => {
  if (e.detail && Array.isArray(e.detail.products) && e.detail.products.length > 0) {
    window.PosApp.inventoryList = e.detail.products;
    if (typeof window.renderInventory === 'function') window.renderInventory();
  }
  if (e.detail && Array.isArray(e.detail.sales)) {
    window.PosApp.allSalesHistory = e.detail.sales;
    const todayMexico = getMexicoDateString();
    window.PosApp.salesHistoryList = e.detail.sales.filter(s => {
      if (!s || !s.created_at) return true;
      return getMexicoDateString(new Date(s.created_at)) === todayMexico;
    });
    if (typeof window.renderSalesHistory === 'function') window.renderSalesHistory();
    if (typeof window.renderCashCut === 'function') window.renderCashCut();
  }
});

// Reloj en tiempo real
function updateClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const liveClock = document.getElementById('liveClock');
  if (liveClock) liveClock.textContent = `${hours}:${minutes}`;
  const dropdownLiveClock = document.getElementById('dropdownLiveClock');
  if (dropdownLiveClock) dropdownLiveClock.textContent = `${hours}:${minutes} hrs`;
}
updateClock();
setInterval(updateClock, 1000);

// Modal de alerta general
function showModal(title, message) {
  const appModal = document.getElementById('appModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  if (modalTitle) modalTitle.textContent = title;
  if (modalBody) modalBody.textContent = message;
  if (appModal) appModal.style.display = 'flex';
}

window.showModal = showModal;

// =========================================================================
// ORQUESTADOR DE INICIALIZACIÓN
// =========================================================================
function initApp() {
  // Configuración de modal general
  const appModal = document.getElementById('appModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => {
      if (appModal) appModal.style.display = 'none';
    });
  }
  if (appModal) {
    appModal.addEventListener('click', (e) => {
      if (e.target === appModal) appModal.style.display = 'none';
    });
  }

  // 1. Inicializar Login y autenticación
  if (typeof window.initLoginAuth === 'function') window.initLoginAuth();

  // 2. Inicializar Módulos de la Aplicación
  if (typeof window.initInventory === 'function') window.initInventory();
  if (typeof window.initSalesHistory === 'function') window.initSalesHistory();
  if (typeof window.initCutCash === 'function') window.initCutCash();
  if (typeof window.initReports === 'function') window.initReports();

  // 3. Inicializar Punto de Venta (POS) y sus submódulos
  if (typeof window.initPos === 'function') window.initPos();
  if (typeof window.initPosSearch === 'function') window.initPosSearch();
  if (typeof window.initPosPayments === 'function') window.initPosPayments();
  if (typeof window.initPosServices === 'function') window.initPosServices();

  // 4. Navegación en el menú lateral
  document.querySelectorAll('.sidebar-menu .nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = link.dataset.view;

      if (targetView === 'inventory') {
        window.switchView('inventory');
      } else if (targetView === 'pos') {
        window.switchView('pos');
      } else if (targetView === 'sales-history') {
        window.switchView('sales-history');
      } else if (targetView === 'cash-cut' || targetView === 'cash-closing') {
        window.switchView('cash-cut');
      } else if (targetView === 'reports') {
        window.switchView('reports');
      } else if (targetView === 'shrinkage') {
        window.switchView('inventory');
        if (typeof window.openShrinkageModal === 'function') window.openShrinkageModal();
      } else {
        const title = link.querySelector('span')?.textContent || 'Módulo';
        showModal('Módulo en Desarrollo', `La sección "${title}" se encuentra en fase de desarrollo.`);
      }
    });
  });

  // 5. Renderizado inicial de vistas
  if (typeof window.renderCart === 'function') window.renderCart();
  if (typeof window.renderInventory === 'function') window.renderInventory();
  if (typeof window.renderSalesHistory === 'function') window.renderSalesHistory();
  if (typeof window.renderCashCut === 'function') window.renderCashCut();
  if (typeof window.renderShrinkageTable === 'function') window.renderShrinkageTable();
  if (typeof window.updateSuspendedBadge === 'function') window.updateSuspendedBadge();
}

window.initApp = initApp;

// Ejecutar inmediatamente si el DOM ya está listo o esperar el evento
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
