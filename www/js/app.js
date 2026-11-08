/**
 * ARCHIVO DE COMPATIBILIDAD (DEPRECADO)
 * La lógica de la aplicación ha sido refactorizada y modularizada en www/js/app/
 * Estructura de módulos:
 *  - www/js/app/app.js (Orquestador principal, navegación y estado compartido)
 *  - www/js/app/login.js (Pantalla de login y autorizaciones)
 *  - www/js/app/cutCash.js (Corte de caja)
 *  - www/js/app/inventory.js (Inventario y mermas)
 *  - www/js/app/salesHistory.js (Historial de ventas y tickets)
 *  - www/js/app/pos/pos.js (Controlador principal del punto de venta)
 *  - www/js/app/pos/posPayments.js (Métodos de pago y cálculo de cambio)
 *  - www/js/app/pos/posSearch.js (Búsqueda predictiva y escáner)
 *  - www/js/app/pos/posServices.js (Servicios y recargas rápidas)
 */
(function() {
  const modules = [
    'js/app/app.js',
    'js/app/login.js',
    'js/app/inventory.js',
    'js/app/salesHistory.js',
    'js/app/cutCash.js',
    'js/app/pos/pos.js',
    'js/app/pos/posSearch.js',
    'js/app/pos/posPayments.js',
    'js/app/pos/posServices.js'
  ];

  modules.forEach(src => {
    if (!document.querySelector(`script[src="${src}"]`)) {
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      document.head.appendChild(s);
    }
  });
})();
