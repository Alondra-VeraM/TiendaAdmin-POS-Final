/**
 * ARCHIVO DE CONFIGURACIÓN GLOBAL
 * Configuración de conexión para Supabase y parámetros del Punto de Venta.
 */

window.ENV_CONFIG = {
  // URL base del proyecto Supabase (se inyecta desde el backend /api/config o localStorage)
  SUPABASE_URL: (typeof localStorage !== 'undefined' && localStorage.getItem('POS_SUPABASE_URL')) || '',

  // Clave pública del proyecto Supabase (se inyecta desde el backend /api/config o localStorage)
  SUPABASE_ANON_KEY: (typeof localStorage !== 'undefined' && localStorage.getItem('POS_SUPABASE_ANON_KEY')) || '',

  // Configuración de la tienda
  STORE_NAME: 'TIENDA ABARROTES NEXUS',
  DEFAULT_ADMIN_PIN: '1234'
};

// Determinar URL del Backend Local (en Electron/Capacitor apunta al servidor local puerto 3000)
if (typeof window !== 'undefined' && !window.BACKEND_API_URL) {
  const proto = window.location ? window.location.protocol : '';
  const host = window.location ? window.location.hostname : '';
  const port = window.location ? window.location.port : '';
  if (proto === 'file:' || proto === 'capacitor-electron:' || proto === 'capacitor:' || (host === 'localhost' && port !== '3000')) {
    window.BACKEND_API_URL = 'http://localhost:3000';
  } else {
    window.BACKEND_API_URL = '';
  }
}

// Cargar configuración desde el servidor local (/api/config lee de .env sin exponer claves en el repositorio)
if (typeof window !== 'undefined' && typeof fetch === 'function') {
  fetch(`${window.BACKEND_API_URL || ''}/api/config`)
    .then(r => r.ok ? r.json() : null)
    .then(cfg => {
      if (cfg && cfg.supabaseUrl && cfg.supabaseAnonKey) {
        window.ENV_CONFIG.SUPABASE_URL = cfg.supabaseUrl;
        window.ENV_CONFIG.SUPABASE_ANON_KEY = cfg.supabaseAnonKey;
        try {
          localStorage.setItem('POS_SUPABASE_URL', cfg.supabaseUrl);
          localStorage.setItem('POS_SUPABASE_ANON_KEY', cfg.supabaseAnonKey);
        } catch (e) {}
      }
    })
    .catch(() => {});
}

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
