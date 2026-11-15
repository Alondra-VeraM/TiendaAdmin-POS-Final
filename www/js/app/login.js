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

  // Elementos para gestión y registro de cajeros
  const loginCashierSection = document.getElementById('loginCashierSection');
  const loginCashierSelect = document.getElementById('loginCashierSelect');
  const btnOpenRegisterCashier = document.getElementById('btnOpenRegisterCashier');
  const linkRegisterCashier = document.getElementById('linkRegisterCashier');
  const cashierPinFieldContainer = document.getElementById('cashierPinFieldContainer');
  const loginCashierPinInput = document.getElementById('loginCashierPinInput');
  const cashierPinInputWrapper = document.getElementById('cashierPinInputWrapper');

  // Modal de registro de nuevo cajero
  const modalRegisterCashier = document.getElementById('modalRegisterCashier');
  const formRegisterCashier = document.getElementById('formRegisterCashier');
  const regCashierFullName = document.getElementById('regCashierFullName');
  const regCashierUsername = document.getElementById('regCashierUsername');
  const regCashierPin = document.getElementById('regCashierPin');
  const regCashierError = document.getElementById('regCashierError');
  const btnCloseRegisterCashier = document.getElementById('btnCloseRegisterCashier');
  const btnCancelRegisterCashier = document.getElementById('btnCancelRegisterCashier');

  let selectedProfile = 'cajero'; // Por defecto Cajero como en Imagen 2

  // =========================================================================
  // GESTIÓN DE CAJEROS (ALMACENAMIENTO Y SINCRONIZACIÓN)
  // =========================================================================
  const DEFAULT_CASHIERS = [
    { id: 'c1', fullName: 'Elena R.', username: 'elena', pin: null },
    { id: 'c2', fullName: 'Cajero General', username: 'cajero', pin: null }
  ];

  function getSavedCashiers() {
    try {
      const saved = (typeof safeGetStorage === 'function') ? safeGetStorage('pos_cashiers_list') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_CASHIERS;
  }

  function saveCashiersList(list) {
    if (typeof safeSetStorage === 'function') {
      safeSetStorage('pos_cashiers_list', JSON.stringify(list));
    }
  }

  function renderCashierSelectOptions(cashiersList, selectedUsername) {
    if (!loginCashierSelect) return;
    const list = cashiersList || getSavedCashiers();
    loginCashierSelect.innerHTML = '';
    list.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.username;
      opt.textContent = `${c.fullName} ${c.pin ? '(con PIN)' : '(sin clave)'}`;
      opt.dataset.fullname = c.fullName;
      opt.dataset.hasPin = c.pin ? 'true' : 'false';
      loginCashierSelect.appendChild(opt);
    });

    if (selectedUsername) {
      loginCashierSelect.value = selectedUsername;
    }
    updateSelectedCashierPinUI();
  }

  function updateSelectedCashierPinUI() {
    const list = getSavedCashiers();
    const selUser = loginCashierSelect ? loginCashierSelect.value : '';
    const cashier = list.find(c => c.username === selUser) || list[0];
    const profileSubtext = profileCardCajero ? profileCardCajero.querySelector('.profile-subtext') : null;

    if (cashier && cashier.pin) {
      if (cashierPinFieldContainer) cashierPinFieldContainer.style.display = 'block';
      if (profileSubtext) profileSubtext.textContent = 'Con PIN';
      if (loginCashierPinInput) setTimeout(() => loginCashierPinInput.focus(), 60);
    } else {
      if (cashierPinFieldContainer) cashierPinFieldContainer.style.display = 'none';
      if (loginCashierPinInput) loginCashierPinInput.value = '';
      if (profileSubtext) profileSubtext.textContent = 'Sin clave';
    }
  }

  if (loginCashierSelect) {
    loginCashierSelect.addEventListener('change', updateSelectedCashierPinUI);
  }

  // Sincronizar cajeros remotos desde Supabase en segundo plano
  async function syncCashiersWithSupabase() {
    let list = getSavedCashiers();
    if (window.PosDataService && typeof window.PosDataService.fetchCashiers === 'function') {
      try {
        const remote = await window.PosDataService.fetchCashiers();
        if (Array.isArray(remote) && remote.length > 0) {
          const map = new Map();
          list.forEach(c => map.set(c.username, c));
          remote.forEach(c => map.set(c.username, c));
          list = Array.from(map.values());
          saveCashiersList(list);
          renderCashierSelectOptions(list, loginCashierSelect ? loginCashierSelect.value : null);
        }
      } catch (err) {
        console.warn('Sync cajeros Supabase error:', err);
      }
    }
  }

  // Cargar lista inicial
  renderCashierSelectOptions();
  syncCashiersWithSupabase();

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
    if (cashierPinInputWrapper) cashierPinInputWrapper.classList.remove('error');

    if (profile === 'cajero') {
      if (profileCardCajero) profileCardCajero.classList.add('selected');
      if (profileCardAdmin) profileCardAdmin.classList.remove('selected');
      if (loginPasswordContainer) loginPasswordContainer.style.display = 'none';
      if (loginCashierSection) loginCashierSection.style.display = 'block';
      updateSelectedCashierPinUI();
    } else {
      if (profileCardAdmin) profileCardAdmin.classList.add('selected');
      if (profileCardCajero) profileCardCajero.classList.remove('selected');
      if (loginCashierSection) loginCashierSection.style.display = 'none';
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

  // =========================================================================
  // MODAL Y ACCIONES PARA REGISTRO DE NUEVO CAJERO
  // =========================================================================
  function openRegisterCashierModal() {
    if (regCashierError) regCashierError.style.display = 'none';
    if (formRegisterCashier) formRegisterCashier.reset();
    if (modalRegisterCashier) modalRegisterCashier.style.display = 'flex';
    if (regCashierFullName) {
      setTimeout(() => regCashierFullName.focus(), 80);
    }
  }

  function closeRegisterCashierModal() {
    if (modalRegisterCashier) modalRegisterCashier.style.display = 'none';
    if (regCashierError) regCashierError.style.display = 'none';
  }

  function showRegCashierError(msg) {
    if (regCashierError) {
      regCashierError.textContent = msg;
      regCashierError.style.display = 'flex';
    }
  }

  if (btnOpenRegisterCashier) btnOpenRegisterCashier.addEventListener('click', openRegisterCashierModal);
  if (linkRegisterCashier) {
    linkRegisterCashier.addEventListener('click', (e) => {
      e.preventDefault();
      openRegisterCashierModal();
    });
  }
  if (btnCloseRegisterCashier) btnCloseRegisterCashier.addEventListener('click', closeRegisterCashierModal);
  if (btnCancelRegisterCashier) btnCancelRegisterCashier.addEventListener('click', closeRegisterCashierModal);
  if (modalRegisterCashier) {
    modalRegisterCashier.addEventListener('click', (e) => {
      if (e.target === modalRegisterCashier) closeRegisterCashierModal();
    });
  }

  // Sugerir identificador / usuario automáticamente mientras escribe el nombre
  if (regCashierFullName && regCashierUsername) {
    regCashierFullName.addEventListener('input', () => {
      if (!regCashierUsername.dataset.manualEdit) {
        const clean = regCashierFullName.value
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '');
        regCashierUsername.value = clean.slice(0, 20);
      }
    });
    regCashierUsername.addEventListener('input', () => {
      regCashierUsername.dataset.manualEdit = 'true';
    });
  }

  // Guardar nuevo cajero
  async function handleRegisterCashierSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const fullName = regCashierFullName ? regCashierFullName.value.trim() : '';
    let username = regCashierUsername ? regCashierUsername.value.trim().toLowerCase() : '';
    const pin = regCashierPin ? regCashierPin.value.trim() : '';

    if (!fullName || fullName.length < 2) {
      showRegCashierError('El nombre completo es obligatorio (mínimo 2 caracteres).');
      if (regCashierFullName) regCashierFullName.focus();
      return;
    }

    if (!username) {
      username = fullName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    }

    if (pin && (pin.length < 4 || isNaN(Number(pin)))) {
      showRegCashierError('El PIN debe ser un código numérico de 4 a 6 dígitos (o déjalo vacío).');
      if (regCashierPin) regCashierPin.focus();
      return;
    }

    const currentList = getSavedCashiers();
    const exists = currentList.some(c => c.username === username);
    if (exists) {
      showRegCashierError(`Ya existe un cajero registrado con el usuario "${username}". Ingresa otro identificador.`);
      if (regCashierUsername) regCashierUsername.focus();
      return;
    }

    const newCashier = {
      id: 'cashier_' + Date.now(),
      fullName: fullName,
      username: username,
      pin: pin || null,
      createdAt: new Date().toISOString()
    };

    currentList.push(newCashier);
    saveCashiersList(currentList);

    // Enviar a Supabase en segundo plano si está disponible
    if (window.PosDataService && typeof window.PosDataService.registerCashierRemote === 'function') {
      window.PosDataService.registerCashierRemote(newCashier).catch(err => {
        console.warn('Registro remoto en Supabase fallback:', err);
      });
    }

    // Seleccionar cajero recién creado en la lista de login
    selectProfile('cajero');
    renderCashierSelectOptions(currentList, newCashier.username);
    closeRegisterCashierModal();

    if (loginAlertMessage) {
      loginAlertMessage.style.display = 'flex';
      loginAlertMessage.style.backgroundColor = '#ecfdf5';
      loginAlertMessage.style.borderColor = '#a7f3d0';
      loginAlertMessage.style.color = '#065f46';
      loginAlertMessage.textContent = `✓ ¡Cajero "${fullName}" registrado y seleccionado con éxito!`;
      setTimeout(() => {
        if (loginAlertMessage.textContent.includes('✓')) {
          loginAlertMessage.style.display = 'none';
        }
      }, 5000);
    }
  }

  if (formRegisterCashier) {
    formRegisterCashier.addEventListener('submit', handleRegisterCashierSubmit);
  }

  // Validación y envío de Inicio de Sesión
  function handleLogin() {
    const dropdownUserName = document.getElementById('dropdownUserName');
    const dropdownUserRole = document.querySelector('.dropdown-user-role');
    const terminalInfo = typeof window.getActiveTerminal === 'function' ? window.getActiveTerminal() : { code: 'C1', name: 'Caja 1' };

    if (selectedProfile === 'cajero') {
      const list = getSavedCashiers();
      const selUser = loginCashierSelect ? loginCashierSelect.value : '';
      const cashier = list.find(c => c.username === selUser) || list[0] || { fullName: 'Cajero', username: 'cajero', pin: null };

      // Si el cajero tiene PIN registrado, validarlo
      if (cashier.pin) {
        const enteredPin = loginCashierPinInput ? loginCashierPinInput.value.trim() : '';
        if (!enteredPin) {
          showLoginError(`Por favor ingresa el PIN de ${cashier.fullName}`);
          if (cashierPinInputWrapper) {
            cashierPinInputWrapper.classList.remove('error');
            void cashierPinInputWrapper.offsetWidth;
            cashierPinInputWrapper.classList.add('error');
          }
          if (loginCashierPinInput) loginCashierPinInput.focus();
          return;
        }

        if (enteredPin !== cashier.pin) {
          showLoginError(`PIN incorrecto para ${cashier.fullName}`);
          if (cashierPinInputWrapper) {
            cashierPinInputWrapper.classList.remove('error');
            void cashierPinInputWrapper.offsetWidth;
            cashierPinInputWrapper.classList.add('error');
          }
          if (loginCashierPinInput) {
            loginCashierPinInput.focus();
            loginCashierPinInput.select();
          }
          return;
        }
      }

      // Sesión iniciada como Cajero
      currentSessionUser = {
        role: 'cajero',
        name: cashier.fullName,
        username: cashier.username
      };
      if (typeof safeSetStorage === 'function') {
        safeSetStorage('pos_current_session_user', JSON.stringify(currentSessionUser));
      }

      if (currentUserName) currentUserName.textContent = cashier.fullName;
      if (dropdownUserName) dropdownUserName.textContent = cashier.fullName;
      if (dropdownUserRole) dropdownUserRole.textContent = `${terminalInfo.name} • Cajero en Turno`;
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
      currentSessionUser = { role: 'admin', name: 'Administrador', username: 'admin' };
      if (typeof safeSetStorage === 'function') {
        safeSetStorage('pos_current_session_user', JSON.stringify(currentSessionUser));
      }

      if (currentUserName) currentUserName.textContent = 'Administrador';
      if (dropdownUserName) dropdownUserName.textContent = 'Administrador';
      if (dropdownUserRole) dropdownUserRole.textContent = `${terminalInfo.name} • Terminal Activa`;
      if (currentUserRole) currentUserRole.textContent = '';

      applyRolePermissions('admin');
      hideLoginScreen();
    }
  }

  function showLoginError(msg) {
    if (loginAlertMessage) {
      loginAlertMessage.textContent = msg;
      loginAlertMessage.style.display = 'flex';
      loginAlertMessage.style.backgroundColor = '#fef2f2';
      loginAlertMessage.style.borderColor = '#fee2e2';
      loginAlertMessage.style.color = '#dc2626';
    }
    if (loginInputWrapper) {
      loginInputWrapper.classList.remove('error');
      void loginInputWrapper.offsetWidth; // reiniciar animación
      loginInputWrapper.classList.add('error');
    }
    if (loginAdminPasswordInput && selectedProfile === 'admin') {
      loginAdminPasswordInput.focus();
      loginAdminPasswordInput.select();
    }
  }

  function hideLoginScreen() {
    if (loginAlertMessage) loginAlertMessage.style.display = 'none';
    if (loginInputWrapper) loginInputWrapper.classList.remove('error');
    if (cashierPinInputWrapper) cashierPinInputWrapper.classList.remove('error');
    if (loginAdminPasswordInput) loginAdminPasswordInput.value = '';
    if (loginCashierPinInput) loginCashierPinInput.value = '';

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
    if (loginCashierPinInput) loginCashierPinInput.value = '';
    if (loginAlertMessage) loginAlertMessage.style.display = 'none';
    if (loginInputWrapper) loginInputWrapper.classList.remove('error');
    if (cashierPinInputWrapper) cashierPinInputWrapper.classList.remove('error');
    renderCashierSelectOptions();
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

  if (loginCashierPinInput) {
    loginCashierPinInput.addEventListener('keydown', (e) => {
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
