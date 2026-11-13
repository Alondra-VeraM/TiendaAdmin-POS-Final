/**
 * RECEPCIÓN DE MERCANCÍA
 * 1. Escanear: cámara del celular (o lector USB / teclado) + cantidad.
 * 2. Factura XML: lee el CFDI del proveedor y suma todo al stock.
 * 3. Cajas: códigos padre (ej. caja de leche = 12 piezas).
 *
 * Sin librerías externas: usa DOMParser (XML) y BarcodeDetector (cámara),
 * que vienen incluidos en el navegador.
 */
(function initReceiving() {
  const data = window.PosDataService;
  const $ = (id) => document.getElementById(id);

  const panel = $('receivePanel');
  const openBtn = $('btnRecibirMercancia');
  if (!panel || !openBtn || !data) return;

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------
  function esc(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function money(n) {
    return '$' + (Number(n) || 0).toFixed(2);
  }

  function showMsg(el, text, type) {
    el.textContent = text;
    el.className = 'rcv-msg rcv-msg-' + type;
    el.style.display = 'block';
  }

  function hideMsg(el) {
    el.style.display = 'none';
  }

  function refreshInventory() {
    if (typeof window.refreshInventoryFromSupabase === 'function') {
      window.refreshInventoryFromSupabase();
    }
  }

  // ---------------------------------------------------------------------------
  // Abrir / cerrar y pestañas
  // ---------------------------------------------------------------------------
  const tabs = panel.querySelectorAll('.rcv-tab');
  const bodies = { scan: $('rcvTabScan'), xml: $('rcvTabXml'), boxes: $('rcvTabBoxes') };

  function showTab(name) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    Object.keys(bodies).forEach(key => {
      bodies[key].style.display = key === name ? 'block' : 'none';
    });
    if (name !== 'scan') stopCamera();
    if (name === 'scan') $('rcvCode').focus();
    if (name === 'boxes') loadBoxes();
  }

  tabs.forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));

  openBtn.addEventListener('click', () => {
    panel.style.display = 'flex';
    showTab('scan');
  });

  function closePanel() {
    stopCamera();
    panel.style.display = 'none';
    refreshInventory();
  }

  $('rcvClose').addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.style.display !== 'none') closePanel();
  });

  // ---------------------------------------------------------------------------
  // 1. ESCANEAR
  // ---------------------------------------------------------------------------
  const codeInput = $('rcvCode');
  const qtyInput = $('rcvQty');
  const foundBox = $('rcvFound');
  const scanMsg = $('rcvScanMsg');
  const logList = $('rcvLog');

  let currentMatch = null;

  async function identifyCode(code) {
    hideMsg(scanMsg);
    currentMatch = null;
    foundBox.style.display = 'none';
    if (!code) return;

    const match = await data.lookupReceivingCode(code);
    if (codeInput.value.trim() !== code) return; // Ya escanearon otro

    if (!match) {
      foundBox.className = 'rcv-found rcv-found-bad';
      foundBox.innerHTML = 'Código no registrado.<br><small>Si es una caja, regístrala en la pestaña "Cajas".</small>';
      foundBox.style.display = 'block';
      return;
    }

    currentMatch = match;
    foundBox.className = 'rcv-found';
    foundBox.innerHTML = match.isPackage
      ? `<strong>${esc(match.product.name)}</strong><span class="rcv-badge">CAJA de ${match.units} pzas</span>`
      : `<strong>${esc(match.product.name)}</strong><span class="rcv-badge rcv-badge-gray">Pieza</span>`;
    foundBox.style.display = 'block';

    qtyInput.value = 1;
    qtyInput.focus();
    qtyInput.select();
  }

  let typingTimer = null;
  codeInput.addEventListener('input', () => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => identifyCode(codeInput.value.trim()), 350);
  });

  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(typingTimer);
      identifyCode(codeInput.value.trim());
    }
  });

  qtyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addScanned();
    }
  });

  $('rcvAddBtn').addEventListener('click', addScanned);

  async function addScanned() {
    const code = codeInput.value.trim();
    const qty = parseInt(qtyInput.value, 10) || 0;

    if (!code) return showMsg(scanMsg, 'Escanea o escribe un código.', 'bad');
    if (qty <= 0) return showMsg(scanMsg, 'Escribe una cantidad mayor a 0.', 'bad');

    const btn = $('rcvAddBtn');
    btn.disabled = true;
    const result = await data.receiveStock(code, qty, null, 'Escáner');
    btn.disabled = false;

    if (!result || !result.ok) {
      return showMsg(scanMsg, (result && result.error) || 'No se pudo guardar.', 'bad');
    }

    const detail = result.is_package
      ? `${qty} caja(s) × ${result.units_per_package} = +${result.units_added} pzas`
      : `+${result.units_added} pzas`;

    showMsg(scanMsg, `${result.product_name}: ${detail}. Stock: ${result.new_stock}`, 'ok');

    const li = document.createElement('li');
    li.innerHTML = `<span>${esc(result.product_name)}</span><strong>+${result.units_added}</strong>`;
    logList.prepend(li);

    codeInput.value = '';
    qtyInput.value = 1;
    foundBox.style.display = 'none';
    currentMatch = null;
    lastDetected = '';
    codeInput.focus();
    refreshInventory();
  }

  // Cámara como lector de código de barras continuo
  const cameraBtn = $('rcvCameraBtn');
  const cameraBox = $('rcvCameraBox');
  const video = $('rcvVideo');
  let stream = null;
  let detector = null;
  let scanTimer = null;
  let lastDetected = '';
  let lastDetectedAt = 0;

  async function startCamera() {
    if (!('BarcodeDetector' in window)) {
      showMsg(scanMsg, 'Este navegador no puede leer códigos con la cámara. Usa Chrome en Android o escribe el código.', 'bad');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showMsg(scanMsg, 'La cámara solo funciona en la app o en una página segura (https).', 'bad');
      return;
    }

    try {
      const wanted = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];
      const supported = await window.BarcodeDetector.getSupportedFormats();
      detector = new window.BarcodeDetector({ formats: wanted.filter(f => supported.includes(f)) });

      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      video.srcObject = stream;
      await video.play();

      cameraBox.style.display = 'block';
      cameraBtn.textContent = 'Apagar cámara';
      hideMsg(scanMsg);
      scanTimer = setInterval(detectFrame, 300);
    } catch (err) {
      stopCamera();
      showMsg(scanMsg, 'No se pudo abrir la cámara. Revisa los permisos.', 'bad');
    }
  }

  async function detectFrame() {
    if (!detector || video.readyState < 2) return;
    try {
      const codes = await detector.detect(video);
      if (!codes.length) return;

      const value = codes[0].rawValue;
      const now = Date.now();
      // Evita leer el mismo código muchas veces seguidas
      if (value === lastDetected && now - lastDetectedAt < 2500) return;
      lastDetected = value;
      lastDetectedAt = now;

      if (navigator.vibrate) navigator.vibrate(80);
      codeInput.value = value;
      identifyCode(value);
    } catch (e) {}
  }

  function stopCamera() {
    clearInterval(scanTimer);
    scanTimer = null;
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
    video.srcObject = null;
    cameraBox.style.display = 'none';
    cameraBtn.textContent = 'Usar cámara';
  }

  cameraBtn.addEventListener('click', () => (stream ? stopCamera() : startCamera()));

  // ---------------------------------------------------------------------------
  // 2. FACTURA XML (CFDI 3.3 / 4.0)
  // ---------------------------------------------------------------------------
  const xmlMsg = $('rcvXmlMsg');
  const xmlResult = $('rcvXmlResult');
  const xmlRows = $('rcvXmlRows');
  let invoice = null;
  let rawXmlText = '';

  // Intenta procesar vía endpoint Node.js Express + xml2js si el servidor está activo
  async function tryBackendEndpoint(xml) {
    try {
      const res = await fetch('/api/cfdi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: xml
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return null;
  }

  // Lee un atributo sin importar si viene "Cantidad" (4.0) o "cantidad" (3.2)
  function attr(el, name) {
    if (!el) return '';
    return el.getAttribute(name) || el.getAttribute(name.charAt(0).toLowerCase() + name.slice(1)) || '';
  }

  function firstByName(doc, localName) {
    const all = doc.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
      if (all[i].localName === localName) return all[i];
    }
    return null;
  }

  function allByName(doc, localName) {
    return Array.from(doc.getElementsByTagName('*')).filter(el => el.localName === localName);
  }

  function parseCfdi(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) {
      throw new Error('El archivo no es un XML válido.');
    }

    const comprobante = firstByName(doc, 'Comprobante');
    if (!comprobante) throw new Error('El XML no es una factura CFDI.');

    const emisor = firstByName(doc, 'Emisor');
    const timbre = firstByName(doc, 'TimbreFiscalDigital');

    const items = allByName(doc, 'Concepto').map(c => ({
      code: attr(c, 'NoIdentificacion').trim(),
      description: attr(c, 'Descripcion'),
      quantity: Math.round(parseFloat(attr(c, 'Cantidad')) || 0),
      unitCost: parseFloat(attr(c, 'ValorUnitario')) || 0
    }));

    return {
      uuid: timbre ? attr(timbre, 'UUID') : '',
      folio: [attr(comprobante, 'Serie'), attr(comprobante, 'Folio')].filter(Boolean).join('-'),
      total: parseFloat(attr(comprobante, 'Total')) || 0,
      supplierName: attr(emisor, 'Nombre') || 'Proveedor',
      supplierRfc: attr(emisor, 'Rfc'),
      items
    };
  }

  function productOptions(selectedId) {
    const products = data.getInventoryProducts();
    return '<option value="">— Elegir —</option>' + products
      .map(p => `<option value="${p.id}" ${Number(p.id) === Number(selectedId) ? 'selected' : ''}>${esc(p.name)}</option>`)
      .join('');
  }

  $('rcvXmlFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    hideMsg(xmlMsg);
    xmlResult.style.display = 'none';
    invoice = null;
    rawXmlText = '';
    if (!file) return;

    try {
      rawXmlText = await file.text();
      invoice = parseCfdi(rawXmlText);
    } catch (err) {
      showMsg(xmlMsg, err.message, 'bad');
      return;
    }

    if (!invoice.items.length) {
      showMsg(xmlMsg, 'La factura no tiene productos.', 'bad');
      return;
    }

    if (await data.isInvoiceReceived(invoice.uuid)) {
      showMsg(xmlMsg, 'Esta factura ya se había cargado antes. No se volverá a sumar.', 'bad');
      invoice = null;
      return;
    }

    // Cruzar cada concepto con el inventario
    for (const item of invoice.items) {
      item.match = item.code ? await data.lookupReceivingCode(item.code) : null;
    }

    $('rcvInvoiceInfo').innerHTML =
      `<strong>${esc(invoice.supplierName)}</strong>` +
      `<span>Folio ${esc(invoice.folio || '—')} · Total ${money(invoice.total)}</span>`;

    xmlRows.innerHTML = invoice.items.map((item, i) => {
      const inventoryCell = item.match
        ? `<span class="rcv-ok">${esc(item.match.product.name)}${item.match.isPackage ? ` (caja ${item.match.units} pzas)` : ''}</span>`
        : `<select class="rcv-input rcv-input-sm" data-row="${i}" data-field="product">${productOptions()}</select>
           <input type="number" class="rcv-input rcv-input-sm" data-row="${i}" data-field="units" value="1" min="1" title="Piezas por unidad de la factura">
           <small>pzas por unidad</small>`;

      return `<tr>
        <td>${esc(item.description)}<br><small>${esc(item.code || 'sin código')}</small></td>
        <td>${item.quantity}</td>
        <td>${money(item.unitCost)}</td>
        <td>${inventoryCell}</td>
      </tr>`;
    }).join('');

    xmlResult.style.display = 'block';
  });

  $('rcvXmlApply').addEventListener('click', async () => {
    if (!invoice) return;
    const btn = $('rcvXmlApply');
    btn.disabled = true;
    hideMsg(xmlMsg);

    // Guardar asignaciones manuales de productos si las hubo
    for (let i = 0; i < invoice.items.length; i++) {
      const item = invoice.items[i];
      if (!item.match) {
        const prodSelect = xmlRows.querySelector(`[data-row="${i}"][data-field="product"]`);
        const unitsInput = xmlRows.querySelector(`[data-row="${i}"][data-field="units"]`);
        if (prodSelect && prodSelect.value) {
          const productId = prodSelect.value;
          const units = parseInt(unitsInput.value, 10) || 1;
          const code = item.code || `CFDI-${invoice.supplierRfc}-${item.description}`.slice(0, 60);
          await data.savePackage({ barcode: code, product_id: productId, units, description: item.description });
        }
      }
    }

    // 1. Intentar procesar en el Backend Node.js (Express + xml2js)
    if (rawXmlText) {
      const backendResult = await tryBackendEndpoint(rawXmlText);
      if (backendResult && backendResult.ok) {
        btn.disabled = false;
        xmlResult.style.display = 'none';
        $('rcvXmlFile').value = '';
        invoice = null;
        rawXmlText = '';
        refreshInventory();
        showMsg(xmlMsg, `Backend Express (xml2js): Se sumaron ${backendResult.piecesAdded} piezas en ${backendResult.productsUpdated} productos. Costos actualizados.`, 'ok');
        return;
      }
    }

    // 2. Procesamiento de respaldo directo en Supabase / Local
    let pieces = 0;
    let products = 0;
    const skipped = [];
    const source = `Factura ${invoice.folio || ''} ${invoice.supplierName}`.trim();

    for (let i = 0; i < invoice.items.length; i++) {
      const item = invoice.items[i];
      let code = item.code || `CFDI-${invoice.supplierRfc}-${item.description}`.slice(0, 60);

      const result = await data.receiveStock(code, item.quantity, item.unitCost, source);
      if (result && result.ok) {
        pieces += result.units_added;
        products++;
      } else {
        skipped.push(item.description);
      }
    }

    if (products > 0) {
      await data.markInvoiceReceived({ ...invoice, piecesAdded: pieces });
    }

    btn.disabled = false;
    xmlResult.style.display = 'none';
    $('rcvXmlFile').value = '';
    invoice = null;
    rawXmlText = '';
    refreshInventory();

    let text = `Se sumaron ${pieces} piezas en ${products} producto(s). Costos actualizados.`;
    if (skipped.length) text += ` No se sumaron: ${skipped.join(', ')}.`;
    showMsg(xmlMsg, text, skipped.length && !products ? 'bad' : 'ok');
  });

  // ---------------------------------------------------------------------------
  // 3. CAJAS (CÓDIGOS PADRE)
  // ---------------------------------------------------------------------------
  const boxMsg = $('rcvBoxMsg');
  const boxList = $('rcvBoxList');

  async function loadBoxes() {
    $('rcvBoxProduct').innerHTML = productOptions();

    const products = data.getInventoryProducts();
    const boxes = await data.getPackages();

    if (!boxes.length) {
      boxList.innerHTML = '<li class="rcv-empty">Aún no hay cajas registradas.</li>';
      return;
    }

    boxList.innerHTML = boxes.map(b => {
      const prod = products.find(p => Number(p.id) === Number(b.product_id));
      return `<li>
        <div>
          <strong>${esc(prod ? prod.name : 'Producto #' + b.product_id)}</strong>
          <small>Caja ${esc(b.barcode)} = ${b.units} pzas</small>
        </div>
        <button type="button" class="rcv-del" data-code="${esc(b.barcode)}" title="Borrar">&times;</button>
      </li>`;
    }).join('');
  }

  boxList.addEventListener('click', async (e) => {
    const btn = e.target.closest('.rcv-del');
    if (!btn) return;
    await data.deletePackage(btn.dataset.code);
    loadBoxes();
  });

  $('rcvBoxSave').addEventListener('click', async () => {
    const barcode = $('rcvBoxCode').value.trim();
    const productId = $('rcvBoxProduct').value;
    const units = parseInt($('rcvBoxUnits').value, 10) || 0;

    if (!barcode || !productId || units <= 0) {
      return showMsg(boxMsg, 'Llena el código, el producto y las piezas.', 'bad');
    }

    const result = await data.savePackage({ barcode, product_id: productId, units });
    if (!result.ok) return showMsg(boxMsg, result.error, 'bad');

    showMsg(boxMsg, 'Caja guardada. Al escanearla se sumarán ' + units + ' piezas.', 'ok');
    $('rcvBoxCode').value = '';
    loadBoxes();
  });

  // ---------------------------------------------------------------------------
  // Tiempo real: si el celular suma stock, la computadora se actualiza sola
  // ---------------------------------------------------------------------------
  let liveTimer = null;
  data.subscribeToProducts && data.subscribeToProducts(() => {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(refreshInventory, 500);
  });
})();

