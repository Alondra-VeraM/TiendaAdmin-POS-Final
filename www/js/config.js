/**
 * ARCHIVO DE CONFIGURACIÓN GLOBAL
 * Configuración de conexión para Supabase y parámetros del Punto de Venta.
 */

window.ENV_CONFIG = {
  // URL base del proyecto Supabase
  SUPABASE_URL: 'https://qluxojdodesadfthugml.supabase.co',

  // Clave pública anónima del proyecto Supabase
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsdXhvamRvZGVzYWRmdGh1Z21sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxODM5NTUsImV4cCI6MjEwNzc1OTk1NX0.t5etK56r6Z2qsHPtjni7wnN1AmUSDEfQXG_4Roum2u0',

  // Configuración de la tienda
  STORE_NAME: 'TIENDA ABARROTES NEXUS',
  DEFAULT_ADMIN_PIN: '1234'
};

// Obtener terminal activa de forma persistente (C1 o C2)
window.getActiveTerminal = function() {
  try {
    const savedCode = localStorage.getItem('pos_terminal_code') || 'C1';
    const code = (savedCode === 'C2') ? 'C2' : 'C1';
    const name = (code === 'C2') ? 'Caja 2' : 'Caja 1';
    return { code, name };
  } catch (e) {
    return { code: 'C1', name: 'Caja 1' };
  }
};

// Guardar terminal activa persistente
window.setActiveTerminal = function(code) {
  const cleanCode = (code === 'C2') ? 'C2' : 'C1';
  try {
    localStorage.setItem('pos_terminal_code', cleanCode);
  } catch (e) {}
  return window.getActiveTerminal();
};

// Generador de folio único y cronológico por terminal (evita colisiones y falsos positivos de idempotencia)
window.generateUniqueFolio = function(terminalCode = 'C1') {
  const code = (terminalCode === 'C2') ? 'C2' : 'C1';
  const now = new Date();
  const y = now.getFullYear().toString().slice(2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const rand = Math.floor(100 + Math.random() * 900);
  return `#TK-${code}-${y}${m}${d}${h}${mi}${s}-${rand}`;
};

// Función para obtener la configuración activa
window.getAppConfig = function() {
  const terminal = window.getActiveTerminal();
  return {
    supabaseUrl: window.ENV_CONFIG.SUPABASE_URL,
    supabaseAnonKey: window.ENV_CONFIG.SUPABASE_ANON_KEY,
    storeName: window.ENV_CONFIG.STORE_NAME,
    terminalCode: terminal.code,
    terminalName: terminal.name,
    adminPin: window.ENV_CONFIG.DEFAULT_ADMIN_PIN
  };
};
