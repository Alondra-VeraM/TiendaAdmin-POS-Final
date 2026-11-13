/**
 * ARCHIVO DE CONFIGURACIÓN GLOBAL
 * Configuración de conexión para Supabase y parámetros del Punto de Venta.
 */

window.ENV_CONFIG = {
  // URL base de tu proyecto Supabase
  SUPABASE_URL: 'https://qluxojdodesadfthugml.supabase.co',

  // Clave pública anónima de tu proyecto Supabase
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsdXhvamRvZGVzYWRmdGh1Z21sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxODM5NTUsImV4cCI6MjEwNzc1OTk1NX0.t5etK56r6Z2qsHPtjni7wnN1AmUSDEfQXG_4Roum2u0',

  // Configuración de la tienda
  STORE_NAME: 'TIENDA ABARROTES NEXUS',
  TERMINAL_CODE: 'C1',
  TERMINAL_NAME: 'Caja 1',
  DEFAULT_ADMIN_PIN: '1234'
};

// Función para obtener la configuración activa
window.getAppConfig = function() {
  return {
    supabaseUrl: window.ENV_CONFIG.SUPABASE_URL,
    supabaseAnonKey: window.ENV_CONFIG.SUPABASE_ANON_KEY,
    storeName: window.ENV_CONFIG.STORE_NAME,
    terminalCode: window.ENV_CONFIG.TERMINAL_CODE,
    terminalName: window.ENV_CONFIG.TERMINAL_NAME,
    adminPin: window.ENV_CONFIG.DEFAULT_ADMIN_PIN
  };
};
