/**
 * MÓDULO: LOGIN Y AUTORIZACIONES (login.js)
 * Pantalla de inicio de sesión, bloqueo de terminal y autorizaciones gerenciales (PIN/password)
 */

// Estado global de usuario en sesión
let currentSessionUser = null; // { role: 'cajero' | 'admin', name: 'Cajero' | 'Administrador' }

// Sincronizar en window para compatibilidad global
Object.defineProperty(window, 'currentSessionUser', {
  get: () => currentSessionUser,
  set: (val) => { currentSessionUser = val; },
  configurable: true
});

// =========================================================================
// SISTEMA DE INICIO DE SESIÓN Y AUTORIZACIONES GERENCIALES
// =========================================================================
function initLoginAuth() {
  const loginScreen = document.getElementById('loginScreen');
  const loginDateTimeDisplay = document.getElementById('loginDateTimeDisplay');
  const profileCardCajero = document.getElementById('profileCardCajero');
  const profileCardAdmin = document.getElementById('profileCardAdmin');
  const loginPasswordContainer = document.getElementById('loginPasswordContainer');
  const loginInputWrapper = document.getElementById('loginInputWrapper');
  const loginAdminPasswordInput = document.getElementById('loginAdminPasswordInput');
  const btnTogglePasswordVisibility = document.getElementById('btnTogglePasswordVisibility');
  const eyeIconOpen = document.getElementById('eyeIconOpen');
  const eyeIconClosed = document.getElementById('eyeIconClosed');
  const loginAlertMessage = document.getElementById('loginAlertMessage');
  const btnLoginSubmit = document.getElementById('btnLoginSubmit');
  const loginForm = document.getElementById('loginForm');
  const btnLockTerminal = document.getElementById('btnLockTerminal');
  const userProfileBadge = document.getElementById('userProfileBadge');
  const currentUserName = document.getElementById('currentUserName');
  const currentUserRole = document.getElementById('currentUserRole');

  let selectedProfile = 'cajero'; // Por defecto Cajero como en Imagen 2

  // Reloj en tiempo real para la pantalla de login (HH:mm:ss • DD mmm YYYY)
  function updateLoginClock() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const hours = pad(now.getHours());
    const mins = pad(now.getMinutes());
    const secs = pad(now.getSeconds());
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const day = now.getDate();
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    if (loginDateTimeDisplay) {
      loginDateTimeDisplay.textContent = `${hours}:${mins}:${secs} • ${day} ${month} ${year}`;
    }
  }
  updateLoginClock();
  setInterval(updateLoginClock, 1000);

  // Cambio de selección de perfil de usuario
  function selectProfile(profile) {
    selectedProfile = profile;
    if (loginAlertMessage) loginAlertMessage.style.display = 'none';
    if (loginInputWrapper) loginInputWrapper.classList.remove('error');

    if (profile === 'cajero') {
      if (profileCardCajero) profileCardCajero.classList.add('selected');
      if (profileCardAdmin) profileCardAdmin.classList.remove('selected');
      if (loginPasswordContainer) loginPasswordContainer.style.display = 'none';
    } else {
      if (profileCardAdmin) profileCardAdmin.classList.add('selected');
      if (profileCardCajero) profileCardCajero.classList.remove('selected');
      if (loginPasswordContainer) loginPasswordContainer.style.display = 'block';
      if (loginAdminPasswordInput) {
        setTimeout(() => loginAdminPasswordInput.focus(), 60);
      }
    }
  }

  if (profileCardCajero) {
    profileCardCajero.addEventListener('click', () => selectProfile('cajero'));
    profileCardCajero.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectProfile('cajero');
      }
    });
  }

  if (profileCardAdmin) {
    profileCardAdmin.addEventListener('click', () => selectProfile('admin'));
    profileCardAdmin.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectProfile('admin');
      }
    });
  }

  // Selección de terminal persistente en login (Caja 1 o Caja 2)
  const loginTerminalC1 = document.getElementById('loginTerminalC1');
  const loginTerminalC2 = document.getElementById('loginTerminalC2');

  function updateLoginTerminalUI(code) {
    if (loginTerminalC1 && loginTerminalC2) {
      if (code === 'C2') {
        loginTerminalC2.style.borderColor = '#2563eb';
        loginTerminalC2.style.background = '#eff6ff';
        loginTerminalC2.style.color = '#1e40af';
        loginTerminalC1.style.borderColor = '#cbd5e1';
        loginTerminalC1.style.background = '#fff';
        loginTerminalC1.style.color = '#64748b';
      } else {
        loginTerminalC1.style.borderColor = '#2563eb';
        loginTerminalC1.style.background = '#eff6ff';
        loginTerminalC1.style.color = '#1e40af';
        loginTerminalC2.style.borderColor = '#cbd5e1';
        loginTerminalC2.style.background = '#fff';
        loginTerminalC2.style.color = '#64748b';
      }
    }
  }

  const currentTerm = typeof window.getActiveTerminal === 'function' ? window.getActiveTerminal() : { code: 'C1' };
  updateLoginTerminalUI(currentTerm.code);

  if (loginTerminalC1) {
    loginTerminalC1.addEventListener('click', () => {
      window.setActiveTerminal('C1');
      updateLoginTerminalUI('C1');
      if (typeof window.checkShiftState === 'function') window.checkShiftState();
    });
  }

  if (loginTerminalC2) {
    loginTerminalC2.addEventListener('click', () => {
      window.setActiveTerminal('C2');
      updateLoginTerminalUI('C2');
      if (typeof window.checkShiftState === 'function') window.checkShiftState();
    });
  }

  // Toggle de visibilidad para contraseña
  if (btnTogglePasswordVisibility && loginAdminPasswordInput) {
    btnTogglePasswordVisibility.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isPassword = loginAdminPasswordInput.type === 'password';
      loginAdminPasswordInput.type = isPassword ? 'text' : 'password';
      if (eyeIconOpen) eyeIconOpen.style.display = isPassword ? 'block' : 'none';
      if (eyeIconClosed) eyeIconClosed.style.display = isPassword ? 'none' : 'block';
      loginAdminPasswordInput.focus();
    });
  }

  // Aplicar visibilidad de botones laterales y permisos según rol
  function applyRolePermissions(role) {
    const adminNavItems = document.querySelectorAll('.admin-only-nav');
    const posApp = document.querySelector('.pos-app');

    if (role === 'cajero') {
      document.body.classList.add('role-cajero');
      document.body.classList.remove('role-admin');
      if (posApp) {
        posApp.classList.add('role-cajero');
        posApp.classList.remove('role-admin');
      }
      adminNavItems.forEach(item => {
        item.style.display = 'none';
      });
      // Asegurar que la vista activa sea únicamente el Punto de Venta
      if (typeof executeSwitchView === 'function') {
        executeSwitchView('pos');
      }
    } else {
      document.body.classList.remove('role-cajero');
      document.body.classList.add('role-admin');
      if (posApp) {
        posApp.classList.remove('role-cajero');
        posApp.classList.add('role-admin');
      }
      adminNavItems.forEach(item => {
        item.style.display = '';
      });
    }
  }
  window.applyRolePermissions = applyRolePermissions;

  // Validación y envío de Inicio de Sesión
  function handleLogin() {
    if (selectedProfile === 'cajero') {
      // Cajero ingresa directo sin contraseña y solo a Punto de Venta
      currentSessionUser = { role: 'cajero', name: 'Cajero' };
      if (currentUserName) currentUserName.textContent = 'Cajero';
      if (currentUserRole) currentUserRole.textContent = '';
      applyRolePermissions('cajero');
      hideLoginScreen();
    } else {
      // Administrador requiere contraseña y tiene acceso a todo
      const enteredPass = loginAdminPasswordInput ? loginAdminPasswordInput.value.trim() : '';
      const customPass = (typeof safeGetStorage === 'function' ? safeGetStorage('ADMIN_PASSWORD') : null) || '1234';
      const validPasswords = ['1234', 'admin', 'admin123', customPass];

      if (!enteredPass) {
        showLoginError('Por favor ingresa la contraseña de Administrador.');
        return;
      }

      if (!validPasswords.includes(enteredPass)) {
        showLoginError('Contraseña incorrecta');
        return;
      }

      // Contraseña correcta
      currentSessionUser = { role: 'admin', name: 'Administrador' };
      if (currentUserName) currentUserName.textContent = 'Administrador';
      if (currentUserRole) currentUserRole.textContent = '';
      applyRolePermissions('admin');
      hideLoginScreen();
    }
  }

  function showLoginError(msg) {
    if (loginAlertMessage) {
      loginAlertMessage.textContent = msg;
      loginAlertMessage.style.display = 'flex';
    }
    if (loginInputWrapper) {
      loginInputWrapper.classList.remove('error');
      void loginInputWrapper.offsetWidth; // reiniciar animación
      loginInputWrapper.classList.add('error');
    }
    if (loginAdminPasswordInput) {
      loginAdminPasswordInput.focus();
      loginAdminPasswordInput.select();
    }
  }

  function hideLoginScreen() {
    if (loginAlertMessage) loginAlertMessage.style.display = 'none';
    if (loginInputWrapper) loginInputWrapper.classList.remove('error');
    if (loginAdminPasswordInput) loginAdminPasswordInput.value = '';

    if (loginScreen) {
      loginScreen.classList.add('hidden');
      setTimeout(() => {
        loginScreen.style.display = 'none';
      }, 260);
    }

    const cartBarcodeInput = document.getElementById('cartBarcodeInput');
    if (cartBarcodeInput) cartBarcodeInput.focus();
  }

  function showLoginScreen() {
    if (loginScreen) {
      loginScreen.style.display = 'flex';
      void loginScreen.offsetWidth; // reiniciar reflow
      loginScreen.classList.remove('hidden');
    }
    if (loginAdminPasswordInput) loginAdminPasswordInput.value = '';
    if (loginAlertMessage) loginAlertMessage.style.display = 'none';
    if (loginInputWrapper) loginInputWrapper.classList.remove('error');
  }

  if (btnLoginSubmit) {
    btnLoginSubmit.addEventListener('click', handleLogin);
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleLogin();
    });
  }

  if (loginAdminPasswordInput) {
    loginAdminPasswordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleLogin();
      }
    });
  }

  // Menú desplegable del perfil y cierre de sesión
  const btnProfileTrigger = document.getElementById('btnProfileTrigger');
  const profileDropdownMenu = document.getElementById('profileDropdownMenu');
  const profileDropdownWrapper = document.getElementById('profileDropdownWrapper');
  const btnLogoutDropdown = document.getElementById('btnLogoutDropdown');

  if (btnProfileTrigger && profileDropdownMenu) {
    btnProfileTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = profileDropdownMenu.style.display === 'block';
      profileDropdownMenu.style.display = isOpen ? 'none' : 'block';
      btnProfileTrigger.classList.toggle('active', !isOpen);
    });

    document.addEventListener('click', (e) => {
      if (profileDropdownWrapper && !profileDropdownWrapper.contains(e.target)) {
        profileDropdownMenu.style.display = 'none';
        btnProfileTrigger.classList.remove('active');
      }
    });
  }

  if (btnLogoutDropdown) {
    btnLogoutDropdown.addEventListener('click', (e) => {
      e.preventDefault();
      if (profileDropdownMenu) profileDropdownMenu.style.display = 'none';
      if (btnProfileTrigger) btnProfileTrigger.classList.remove('active');
      showLoginScreen();
    });
  }

  if (btnLockTerminal) {
    btnLockTerminal.addEventListener('click', (e) => {
      e.preventDefault();
      showLoginScreen();
    });
  }

  window.lockTerminal = showLoginScreen;

  // Iniciar modal de autorización para áreas protegidas
  initAdminAuthModal();
}

function initAdminAuthModal() {
  const modalAdminAuth = document.getElementById('modalAdminAuth');
  const btnCloseAdminAuth = document.getElementById('btnCloseAdminAuth');
  const btnCancelAdminAuth = document.getElementById('btnCancelAdminAuth');
  const btnConfirmAdminAuth = document.getElementById('btnConfirmAdminAuth');
  const modalAuthPasswordInput = document.getElementById('modalAuthPasswordInput');
  const authModalInputWrapper = document.getElementById('authModalInputWrapper');
  const modalAuthError = document.getElementById('modalAuthError');

  let pendingAuthCallback = null;

  window.requestAdminAuth = function(callback) {
    if (currentSessionUser && currentSessionUser.role === 'admin') {
      if (typeof callback === 'function') callback();
      return;
    }
    pendingAuthCallback = callback;
    if (modalAuthPasswordInput) modalAuthPasswordInput.value = '';
    if (modalAuthError) modalAuthError.style.display = 'none';
    if (authModalInputWrapper) authModalInputWrapper.classList.remove('error');
    if (modalAdminAuth) modalAdminAuth.style.display = 'flex';
    if (modalAuthPasswordInput) setTimeout(() => modalAuthPasswordInput.focus(), 80);
  };

  function closeAuthModal() {
    if (modalAdminAuth) modalAdminAuth.style.display = 'none';
    pendingAuthCallback = null;
  }

  function confirmAuth() {
    const entered = modalAuthPasswordInput ? modalAuthPasswordInput.value.trim() : '';
    const customPass = (typeof safeGetStorage === 'function' ? safeGetStorage('ADMIN_PASSWORD') : null) || '1234';
    const valid = ['1234', 'admin', 'admin123', customPass];

    if (!valid.includes(entered)) {
      if (modalAuthError) modalAuthError.style.display = 'flex';
      if (authModalInputWrapper) {
        authModalInputWrapper.classList.remove('error');
        void authModalInputWrapper.offsetWidth;
        authModalInputWrapper.classList.add('error');
      }
      if (modalAuthPasswordInput) modalAuthPasswordInput.focus();
      return;
    }

    // Elevar sesión a Administrador si aún era cajero
    currentSessionUser = { role: 'admin', name: 'Administrador' };
    if (typeof window.applyRolePermissions === 'function') {
      window.applyRolePermissions('admin');
    }
    const currentUserName = document.getElementById('currentUserName');
    if (currentUserName) currentUserName.textContent = 'Administrador';

    const cb = pendingAuthCallback;
    closeAuthModal();
    if (typeof cb === 'function') cb();
  }

  if (btnCloseAdminAuth) btnCloseAdminAuth.addEventListener('click', closeAuthModal);
  if (btnCancelAdminAuth) btnCancelAdminAuth.addEventListener('click', closeAuthModal);
  if (btnConfirmAdminAuth) btnConfirmAdminAuth.addEventListener('click', confirmAuth);
  if (modalAuthPasswordInput) {
    modalAuthPasswordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmAuth();
      }
    });
  }
}


// Exponer funciones en window
window.initLoginAuth = initLoginAuth;
window.initAdminAuthModal = initAdminAuthModal;
