/**
 * LECTOR POS - Terminal movil
 * Dos modos: "Cobrar" (manda al carrito de la PC) y "Agregar al Inventario".
 * Cada escaneo consulta la API de Open Food Facts y muestra la informacion del producto.
 */

(function () {
  'use strict';

  // =========================================================================
  // CONFIGURACION DEL SERVIDOR (PC con el POS)
  // =========================================================================
  function resolveServerUrl() {
    const saved = localStorage.getItem('pos_server_url');
    if (saved) return saved.replace(/\/+$/, '');
    const host = window.location.hostname;
    // Abierto desde el navegador del celular apuntando a la PC
    if (window.location.protocol.startsWith('http') && host && host !== 'localhost' && host !== '127.0.0.1') {
      return `${window.location.protocol}//${window.location.host}`;
    }
    // App Android (Capacitor sirve en localhost): IP de la PC por defecto
    return 'http://192.168.0.12:3000';
  }

  const serverUrl = resolveServerUrl();

  // =========================================================================
  // ESTADO
  // =========================================================================
  let mode = 'cobrar';            // 'cobrar' | 'inventario'
  let currentProduct = null;
  let html5QrCode = null;
  let isScanning = false;
  let isProcessing = false;
  let lastCode = '';
  let lastTime = 0;
  let isTorchOn = false;

  // =========================================================================
  // ELEMENTOS
  // =========================================================================
  const $ = (id) => document.getElementById(id);
  const tabCobrar = $('tabCobrar');
  const tabInventario = $('tabInventario');
  const manualCode = $('manualCode');
  const btnManual = $('btnManual');
  const btnTorch = $('btnTorch');
  const resultCard = $('resultCard');
  const prodImage = $('prodImage');
  const prodTitle = $('prodTitle');
  const prodCode = $('prodCode');
  const prodMeta = $('prodMeta');
  const prodPrice = $('prodPrice');
  const apiSourceBadge = $('apiSourceBadge');
  const statusPill = $('statusPill');
  const invFields = $('invFields');
  const editName = $('editName');
  const editPrice = $('editPrice');
  const editCost = $('editCost');
  const inputQty = $('inputQty');
  const btnQtyMinus = $('btnQtyMinus');
  const btnQtyPlus = $('btnQtyPlus');
  const btnSaveInventory = $('btnSaveInventory');
  const lanDot = $('lanDot');
  const lanText = $('lanText');

  // =========================================================================
  // UTILIDADES
  // =========================================================================
  function setPill(text, type) {
    const colors = {
      ok: ['#dcfce7', '#15803d'],
      info: ['#eff6ff', '#1d4ed8'],
      warn: ['#fef3c7', '#92400e'],
      error: ['#fee2e2', '#b91c1c']
    };
    const c = colors[type] || colors.info;
    statusPill.textContent = text;
    statusPill.style.background = c[0];
    statusPill.style.color = c[1];
  }

  async function fetchWithTimeout(url, options = {}, ms = 5000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(t);
    }
  }

  let audioCtx = null;
  function beep(isError) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = isError ? 'square' : 'sine';
      osc.frequency.setValueAtTime(isError ? 420 : 1850, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + (isError ? 0.25 : 0.08));
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + (isError ? 0.25 : 0.08));
    } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate(isError ? [90, 60, 90] : 60); } catch (e) {}
  }

  // =========================================================================
  // 1. CAMBIO DE MODO
  // =========================================================================
  function applyModeToCard() {
    if (!currentProduct) return;
    if (mode === 'inventario') {
      invFields.style.display = 'flex';
      setPill('Edita y guarda', 'info');
    } else {
      invFields.style.display = 'none';
    }
  }

  tabCobrar.addEventListener('click', () => {
    mode = 'cobrar';
    tabCobrar.classList.add('active');
    tabInventario.classList.remove('active');
    invFields.style.display = 'none';
    resultCard.style.display = 'none';
    currentProduct = null;
  });

  tabInventario.addEventListener('click', () => {
    mode = 'inventario';
    tabInventario.classList.add('active');
    tabCobrar.classList.remove('active');
    resultCard.style.display = 'none';
    currentProduct = null;
  });

  // =========================================================================
  // 2. CONSULTA DE INFORMACION DEL PRODUCTO
  //    Orden: Servidor POS (inventario + Open Food Facts) -> Open Food Facts
  //    directo desde el celular -> Catalogo mexicano local.
  // =========================================================================
  function buildOffName(p, code) {
    const base = (p.product_name_es || p.product_name || p.generic_name_es || p.generic_name || '').trim();
    const brand = (p.brands || p.brand_owner || '').split(',')[0].trim();
    const qty = String(p.quantity || '').trim();
    let name = base;
    if (brand && !name.toLowerCase().includes(brand.toLowerCase().split(' ')[0])) name = `${brand} ${name}`.trim();
    if (qty && !name.toLowerCase().includes(qty.toLowerCase())) name = `${name} ${qty}`.trim();
    return name || `Producto ${code}`;
  }

  async function identifyProduct(code) {
    const catalog = (typeof window.lookupMexicoBarcode === 'function') ? window.lookupMexicoBarcode(code) : null;

    // A. Servidor POS: primero busca en inventario, despues en Open Food Facts
    try {
      const res = await fetchWithTimeout(`${serverUrl}/api/producto/${encodeURIComponent(code)}`, {}, 7000);
      if (res.ok) {
        const json = await res.json();
        const p = json.product || json.producto;
        if (p && (p.nombre || p.name)) {
          const inStore = json.status === 'existing';
          return {
            barcode: code,
            name: p.nombre || p.name,
            brand: p.marca || '',
            category: p.categoria || (catalog && catalog.category) || 'Abarrotes',
            image: p.imagen || '',
            stock: inStore ? (parseInt(p.stock, 10) || 0) : null,
            price: parseFloat(p.precio_venta) || (catalog && catalog.suggestedPrice) || 0,
            cost: parseFloat(p.precio_costo) || (catalog && catalog.suggestedCost) || 0,
            source: inStore ? 'Ya está en tu inventario' : 'Open Food Facts (API)'
          };
        }
      }
    } catch (e) {
      console.warn('Servidor POS no respondio a la consulta:', e);
    }

    // B. Open Food Facts directo desde el celular (si el servidor no respondio)
    try {
      const res = await fetchWithTimeout(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_es,generic_name,generic_name_es,brands,brand_owner,quantity,categories,image_front_small_url`,
        {},
        6000
      );
      if (res.ok) {
        const json = await res.json();
        if (json && json.status === 1 && json.product) {
          const p = json.product;
          return {
            barcode: code,
            name: buildOffName(p, code),
            brand: (p.brands || '').split(',')[0].trim(),
            category: (p.categories || 'Abarrotes').split(',')[0].trim(),
            image: p.image_front_small_url || '',
            stock: null,
            price: (catalog && catalog.suggestedPrice) || 0,
            cost: (catalog && catalog.suggestedCost) || 0,
            source: 'Open Food Facts (API)'
          };
        }
      }
    } catch (e) {
      console.warn('Open Food Facts no respondio:', e);
    }

    // C. Catalogo mexicano local
    if (catalog && catalog.name) {
      return {
        barcode: code,
        name: catalog.name,
        brand: catalog.brand || '',
        category: catalog.category || 'Abarrotes',
        image: '',
        stock: null,
        price: catalog.suggestedPrice || 0,
        cost: catalog.suggestedCost || 0,
        source: 'Catálogo México'
      };
    }

    // D. No encontrado en ningun lado
    return {
      barcode: code,
      name: '',
      brand: '',
      category: 'Abarrotes',
      image: '',
      stock: null,
      price: 0,
      cost: 0,
      source: 'No encontrado: escribe el nombre'
    };
  }

  function renderProduct(prod) {
    resultCard.style.display = 'block';
    prodTitle.textContent = prod.name || 'Producto sin nombre';
    prodCode.textContent = `Código: ${prod.barcode}`;

    const parts = [];
    if (prod.brand) parts.push(`Marca: ${prod.brand}`);
    if (prod.category) parts.push(`Categoría: ${prod.category}`);
    if (prod.stock !== null && prod.stock !== undefined) parts.push(`Stock: ${prod.stock}`);
    prodMeta.textContent = parts.join(' · ') || '-';

    prodPrice.textContent = prod.price > 0 ? `Precio: $${Number(prod.price).toFixed(2)}` : 'Precio: sin definir';
    apiSourceBadge.textContent = prod.source;

    if (prod.image) {
      prodImage.src = prod.image;
      prodImage.style.display = 'block';
      prodImage.onerror = () => { prodImage.style.display = 'none'; };
    } else {
      prodImage.style.display = 'none';
    }

    // Prellenar campos editables
    editName.value = prod.name || '';
    editPrice.value = prod.price > 0 ? Number(prod.price).toFixed(2) : '';
    editCost.value = prod.cost > 0 ? Number(prod.cost).toFixed(2) : '';
    inputQty.value = 1;
  }

  // =========================================================================
  // 3. PROCESAR ESCANEO
  // =========================================================================
  async function onScan(code) {
    const clean = String(code || '').trim();
    if (!clean || isProcessing) return;

    const now = Date.now();
    if (clean === lastCode && (now - lastTime) < 2000) return;
    lastCode = clean;
    lastTime = now;

    // En inventario, pausar mientras el usuario edita para no sobreescribir
    if (mode === 'inventario' && currentProduct && invFields.style.display === 'flex' && currentProduct.barcode !== clean) {
      // Se permite escanear otro producto: reemplaza el actual
    }

    isProcessing = true;
    beep(false);

    resultCard.style.display = 'block';
    prodTitle.textContent = 'Consultando producto...';
    prodCode.textContent = `Código: ${clean}`;
    prodMeta.textContent = 'Buscando en inventario y Open Food Facts';
    prodPrice.textContent = '';
    apiSourceBadge.textContent = 'Buscando...';
    setPill('...', 'info');
    invFields.style.display = 'none';
    prodImage.style.display = 'none';

    try {
      const prod = await identifyProduct(clean);
      currentProduct = prod;
      renderProduct(prod);

      if (mode === 'cobrar') {
        await sendToCheckout(prod);
      } else {
        invFields.style.display = 'flex';
        setPill('Edita y guarda', 'info');
        if (!prod.name) editName.focus();
      }
    } finally {
      isProcessing = false;
    }
  }

  // =========================================================================
  // 4. COBRAR: mandar al carrito de la PC
  // =========================================================================
  async function sendToCheckout(prod) {
    setPill('Enviando a caja...', 'info');
    try {
      const res = await fetchWithTimeout(`${serverUrl}/api/pos/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: prod.barcode,
          mode: 'sale',
          quantity: 1,
          metadata: { name: prod.name || `Producto ${prod.barcode}`, price: prod.price }
        })
      }, 5000);
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setPill('En la caja', 'ok');
        return true;
      }
      throw new Error(json.error || `HTTP ${res.status}`);
    } catch (err) {
      console.error('No se pudo mandar a la caja:', err);
      beep(true);
      setPill('NO se envió', 'error');
      alert(`No se pudo mandar a la caja.\n\nRevisa que la PC tenga el servidor encendido y que estés en la misma red Wi-Fi.\nServidor: ${serverUrl}`);
      return false;
    }
  }

  // =========================================================================
  // 5. INVENTARIO: guardar con nombre, precio y costo editables
  // =========================================================================
  btnQtyMinus.addEventListener('click', () => {
    const q = parseInt(inputQty.value, 10) || 1;
    inputQty.value = Math.max(1, q - 1);
  });

  btnQtyPlus.addEventListener('click', () => {
    const q = parseInt(inputQty.value, 10) || 0;
    inputQty.value = q + 1;
  });

  btnSaveInventory.addEventListener('click', async () => {
    if (!currentProduct) return;

    const name = editName.value.trim();
    const price = parseFloat(editPrice.value) || 0;
    const cost = parseFloat(editCost.value) || 0;
    const qty = parseInt(inputQty.value, 10) || 1;

    if (!name) {
      alert('Escribe el nombre del producto.');
      editName.focus();
      return;
    }

    btnSaveInventory.disabled = true;
    btnSaveInventory.textContent = 'Guardando...';

    try {
      const res = await fetchWithTimeout(`${serverUrl}/api/producto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo_barras: currentProduct.barcode,
          nombre: name,
          marca: currentProduct.brand || '',
          categoria: currentProduct.category || 'Abarrotes',
          precio_costo: cost,
          precio_venta: price,
          cantidad_entrante: qty,
          origen: 'escaner_movil'
        })
      }, 6000);
      const json = await res.json().catch(() => ({}));

      if (!res.ok || json.error) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      beep(false);
      currentProduct.name = name;
      currentProduct.price = price;
      currentProduct.cost = cost;
      prodTitle.textContent = name;
      prodPrice.textContent = price > 0 ? `Precio: $${price.toFixed(2)}` : 'Precio: sin definir';
      const newStock = json.producto && json.producto.stock;
      prodMeta.textContent = `Guardado: +${qty} pzas${newStock !== undefined ? ` · Stock total: ${newStock}` : ''}`;
      setPill('Guardado', 'ok');
      invFields.style.display = 'none';
      lastCode = '';
    } catch (err) {
      console.error('Error guardando en inventario:', err);
      beep(true);
      setPill('NO se guardó', 'error');
      alert(`No se pudo guardar en el inventario.\n\nRevisa la conexión con la PC.\nServidor: ${serverUrl}`);
    } finally {
      btnSaveInventory.disabled = false;
      btnSaveInventory.textContent = 'Guardar en Inventario';
    }
  });

  // =========================================================================
  // 6. ENTRADA MANUAL
  // =========================================================================
  function submitManual() {
    const val = manualCode.value.trim();
    if (val) {
      lastCode = '';
      onScan(val);
      manualCode.value = '';
      manualCode.blur();
    }
  }
  btnManual.addEventListener('click', submitManual);
  manualCode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitManual();
    }
  });

  // =========================================================================
  // 7. LINTERNA
  // =========================================================================
  btnTorch.addEventListener('click', async () => {
    if (!html5QrCode || !isScanning) return;
    try {
      isTorchOn = !isTorchOn;
      await html5QrCode.applyVideoConstraints({ advanced: [{ torch: isTorchOn }] });
      btnTorch.style.background = isTorchOn ? '#fef08a' : '#fff';
    } catch (e) {
      isTorchOn = false;
    }
  });

  // =========================================================================
  // 8. CONEXION CON LA PC (tocar el texto para cambiar la IP)
  // =========================================================================
  async function checkLan() {
    try {
      const res = await fetchWithTimeout(`${serverUrl}/api/pos/ping`, {}, 3000);
      if (res.ok) {
        lanDot.className = 'lan-dot';
        lanText.textContent = `Conectado a la PC (${serverUrl.replace(/https?:\/\//, '')})`;
        return;
      }
    } catch (e) {}
    lanDot.className = 'lan-dot off';
    lanText.textContent = `Sin conexión con la PC (${serverUrl.replace(/https?:\/\//, '')}). Toca aquí para cambiar la IP`;
  }
  setInterval(checkLan, 5000);
  checkLan();

  const lanInfoEl = document.querySelector('.lan-info');
  if (lanInfoEl) {
    lanInfoEl.style.cursor = 'pointer';
    lanInfoEl.addEventListener('click', () => {
      const newUrl = prompt('Dirección de la PC (ej: http://192.168.0.12:3000):', serverUrl);
      if (newUrl && newUrl.trim()) {
        let clean = newUrl.trim().replace(/\/+$/, '');
        if (!/^https?:\/\//i.test(clean)) clean = `http://${clean}`;
        if (!/:\d+$/.test(clean)) clean = `${clean}:3000`;
        localStorage.setItem('pos_server_url', clean);
        window.location.reload();
      }
    });
  }

  // =========================================================================
  // 9. CAMARA (toca el recuadro negro si no arranca)
  // =========================================================================
  async function initCamera() {
    if (!window.Html5Qrcode || isScanning) return;
    try {
      if (!html5QrCode) html5QrCode = new window.Html5Qrcode('reader');
      const F = window.Html5QrcodeSupportedFormats;
      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 12,
          qrbox: { width: 260, height: 130 },
          aspectRatio: 1.5,
          formatsToSupport: F ? [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39] : undefined
        },
        onScan,
        () => {}
      );
      isScanning = true;
    } catch (err) {
      console.warn('No se pudo abrir la cámara:', err);
      const box = document.querySelector('.camera-box');
      if (box && !document.getElementById('cameraHint')) {
        const hint = document.createElement('div');
        hint.id = 'cameraHint';
        hint.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#cbd5e1;font-size:14px;text-align:center;padding:16px;';
        hint.textContent = 'Toca aquí para activar la cámara (o escribe el código abajo)';
        box.appendChild(hint);
        box.addEventListener('click', async () => {
          await initCamera();
          if (isScanning) hint.remove();
        });
      }
    }
  }

  initCamera();
})();
