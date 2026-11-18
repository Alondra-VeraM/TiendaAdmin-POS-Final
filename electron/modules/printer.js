const { ipcMain, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

/**
 * Helper para enviar bytes RAW directamente a una impresora
  a través de la API nativa winspool.drv.
 */
function sendRawToWindowsPrinter(printerName, rawBytes) {
    return new Promise((resolve, reject) => {
        const tempBinPath = path.join(os.tmpdir(), `pos58_raw_${Date.now()}_${Math.floor(Math.random() * 1000)}.bin`);
        fs.writeFileSync(tempBinPath, rawBytes);

        const psScript = `
$code = @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendFileToPrinter(string szPrinterName, string szFileName) {
        if (!File.Exists(szFileName)) return false;
        byte[] bytes = File.ReadAllBytes(szFileName);
        IntPtr hPrinter = new IntPtr(0);
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "Ticket Venta POS-58";
        di.pDataType = "RAW";
        bool bSuccess = false;

        if (OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                    Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                    int written = 0;
                    bSuccess = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out written);
                    Marshal.FreeCoTaskMem(pUnmanagedBytes);
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        return bSuccess;
    }
}
"@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
$res = [RawPrinterHelper]::SendFileToPrinter("${printerName.replace(/"/g, '`"')}", "${tempBinPath.replace(/\\/g, '\\\\')}")
if ($res) { exit 0 } else { exit 1 }
`;

        const tempPsPath = path.join(os.tmpdir(), `pos58_script_${Date.now()}.ps1`);
        fs.writeFileSync(tempPsPath, psScript, 'utf-8');

        execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tempPsPath], (error) => {
            try {
                if (fs.existsSync(tempBinPath)) fs.unlinkSync(tempBinPath);
                if (fs.existsSync(tempPsPath)) fs.unlinkSync(tempPsPath);
            } catch (e) {}

            if (error) {
                console.error('[RawPrinter] Error enviando RAW a la impresora:', error);
                reject(error);
            } else {
                console.log(`[RawPrinter] Datos RAW enviados exitosamente a "${printerName}".`);
                resolve(true);
            }
        });
    });
}

/**
 * Codifica una cadena de texto a bytes CP850 (compatible con tildes y caracteres en español para POS-58)
 */
function encodeCP850(str) {
    const map = {
        'á': 0xA0, 'é': 0x82, 'í': 0xA1, 'ó': 0xA2, 'ú': 0xA3,
        'Á': 0x41, 'É': 0x90, 'Í': 0x49, 'Ó': 0x4F, 'Ú': 0x55,
        'ñ': 0xA4, 'Ñ': 0xA5,
        '¡': 0xAD, '¿': 0xA8,
        'ü': 0x81, 'Ü': 0x9A
    };
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (map[c] !== undefined) {
            bytes.push(map[c]);
        } else {
            const code = c.charCodeAt(0);
            bytes.push(code <= 127 ? code : 0x20);
        }
    }
    return Buffer.from(bytes);
}

/**
 * Formatea una fila de 2 columnas justificadas a los extremos en N caracteres
 */
function formatTwoCols(left, right, width = 32) {
    const l = String(left || '');
    const r = String(right || '');
    const spaces = Math.max(1, width - l.length - r.length);
    return l + ' '.repeat(spaces) + r;
}

/**
 * Determina el nombre del cajero a mostrar en el ticket.
 * Retorna null si no tiene nombre o si el cobro fue realizado por un administrador.
 */
function getCashierDisplayName(cashier, role) {
    if (!cashier && !role) return null;
    const roleStr = String(role || '').trim().toLowerCase();
    if (roleStr === 'admin' || roleStr === 'administrador' || roleStr === 'gerente') {
        return null;
    }
    const nameStr = String(cashier || '').trim();
    if (!nameStr) return null;
    const lowerName = nameStr.toLowerCase();
    if (
        lowerName === 'admin' ||
        lowerName === 'administrador' ||
        lowerName === 'administrator' ||
        lowerName === 'gerente'
    ) {
        return null;
    }
    return nameStr;
}

/**
 * Construye el buffer binario con comandos ESC/POS según el layout especificado para 5.2 cm (32 columnas)
 */
function buildEscPosTicket(data) {
    const ESC = 0x1B;
    const GS = 0x1D;
    const buffers = [];

    const add = (b) => buffers.push(Buffer.from(b));
    const addText = (str) => buffers.push(encodeCP850(str));
    const addLine = (str = '') => addText(str + '\n');

    // 1. Inicializar impresora y seleccionar CodePage 850 (Latin I)
    add([ESC, 0x40]);           // ESC @ (Reset)
    add([ESC, 0x74, 0x02]);     // ESC t 2 (CP850)

    // Reset absoluto de márgenes y área para evitar desplazamiento a la derecha
    add([GS, 0x4C, 0x00, 0x00]); // GS L 0 0: Margen izquierdo en 0 puntos (alineación absoluta izquierda)
    add([ESC, 0x6C, 0x00]);       // ESC l 0: Margen izquierdo en columna 0
    add([GS, 0x57, 0x80, 0x01]); // GS W 384 (0x0180): Ancho de área de impresión 384 puntos (48mm)
    add([ESC, 0x20, 0x00]);       // ESC SP 0: Sin espacio extra entre caracteres
    add([ESC, 0x32]);             // ESC 2: Interlineado estándar por defecto

    // 2. Título "store_settings: store_name" (centrado, negrita)
    add([ESC, 0x61, 0x01]);     // Center
    add([ESC, 0x45, 0x01]);     // Bold ON
    addLine(data.storeName || 'TIENDA ABARROTES');
    add([ESC, 0x45, 0x00]);     // Bold OFF

    // 3. Dirección "store_settings: adress" (centrada)
    if (data.storeAddress) {
        // Dividir si tiene más de 32 caracteres para que no corte palabras abruptamente
        const words = data.storeAddress.split(' ');
        let curLine = '';
        words.forEach(w => {
            if ((curLine + ' ' + w).trim().length <= 32) {
                curLine = (curLine + ' ' + w).trim();
            } else {
                if (curLine) addLine(curLine);
                curLine = w;
            }
        });
        if (curLine) addLine(curLine);
    }

    // 4. Subtítulo: Ticket de Venta
    add([ESC, 0x45, 0x01]);     // Bold ON
    addLine('Ticket de Venta');
    add([ESC, 0x45, 0x00]);     // Bold OFF

    // 5. Fecha y Caja
    addLine(`Fecha: ${data.date || new Date().toLocaleString()}`);
    addLine(`Caja: ${data.caja || 'Caja 1'}`);

    // Cajero: nombre del cajero que atendió (únicamente abajo de caja; omitir si no tiene nombre o fue admin)
    const rawCashier = data.cashier || data.cashierName || data.user || data.userName || data.cajero;
    const rawRole = data.role || data.userRole || data.user_role;
    const cashierToPrint = getCashierDisplayName(rawCashier, rawRole);
    if (cashierToPrint) {
        addLine(`Cajero: ${cashierToPrint}`);
    }

    // 6. Separador con una línea punteada
    addLine('--------------------------------');

    // 7. Productos: cada producto es una fila (cantidad, nombre, total)
    add([ESC, 0x61, 0x00]);     // Left align
    const items = Array.isArray(data.items) ? data.items : [];
    items.forEach(it => {
        const qtyStr = `${it.quantity || 1}x `;
        const totalNum = parseFloat(it.total != null ? it.total : ((it.price || it.unitPrice || 0) * (it.quantity || 1)));
        const priceStr = `$${totalNum.toFixed(2)}`;

        // Espacio para nombre = 32 - len(qtyStr) - len(priceStr)
        const maxNameLen = Math.max(1, 32 - qtyStr.length - priceStr.length);
        let name = String(it.name || 'Artículo');
        if (name.length > maxNameLen) {
            name = name.substring(0, maxNameLen);
        }
        const spaces = ' '.repeat(Math.max(1, 32 - qtyStr.length - name.length - priceStr.length));
        addLine(`${qtyStr}${name}${spaces}${priceStr}`);
    });

    // 8. Separador con una línea punteada
    addLine('--------------------------------');

    // 9. En grande y en negritas el total a pagar
    const totalVal = parseFloat(data.total || 0).toFixed(2);
    add([ESC, 0x45, 0x01]);     // Bold ON
    add([GS, 0x21, 0x11]);      // Doble ancho + doble alto
    addLine(`TOTAL: $${totalVal}`);
    add([GS, 0x21, 0x00]);      // Tamaño normal
    add([ESC, 0x45, 0x00]);     // Bold OFF

    // 10. Efectivo recibido y cambio
    const recVal = parseFloat(data.amountReceived != null ? data.amountReceived : (data.total || 0)).toFixed(2);
    const chgVal = parseFloat(data.change != null ? data.change : 0).toFixed(2);
    addLine(formatTwoCols('Efectivo recibido:', `$${recVal}`, 32));
    addLine(formatTwoCols('Cambio:', `$${chgVal}`, 32));

    // 11. Forma de pago
    addLine(formatTwoCols('Forma de pago:', data.paymentMethod || 'Efectivo', 32));

    // 12. Al final: ¡Gracias por su Compra! (centrado)
    addLine('--------------------------------');
    add([ESC, 0x61, 0x01]);     // Center
    add([ESC, 0x45, 0x01]);     // Bold ON
    addLine('¡Gracias por su Compra!');
    add([ESC, 0x45, 0x00]);     // Bold OFF

    // Avance de papel para salir del cabezal térmico y corte
    addLine('\n\n\n\n');
    add([GS, 0x56, 0x42, 0x00]); // GS V B 0 (Corte parcial si cuenta con cuchilla)

    return Buffer.concat(buffers);
}

function registerPrinterHandlers() {

    // Handler para consultar impresoras instaladas en el sistema
    ipcMain.handle('get-printers', async (event) => {
        try {
            const parentWindow = BrowserWindow.fromWebContents(event.sender);
            if (!parentWindow) return [];
            return await parentWindow.webContents.getPrintersAsync();
        } catch (error) {
            console.error('Error al obtener impresoras:', error);
            return [];
        }
    });

    // Handler para imprimir el ticket en la POS-58
    ipcMain.handle('print-ticket', async (event, ticketInput) => {

        const parentWindow = BrowserWindow.fromWebContents(event.sender);
        if (!parentWindow || !ticketInput) {
            throw new Error('No se recibió la información del ticket para imprimir.');
        }

        // Obtener impresoras detectadas por el sistema
        const printers = await parentWindow.webContents.getPrintersAsync();
        if (!printers || printers.length === 0) {
            throw new Error('No se detectó ninguna impresora instalada en el sistema.');
        }

        // 1. Coincidencia exacta "POS-58"
        let printer = printers.find(p => p.name.trim().toLowerCase() === 'pos-58');

        // 2. Coincidencia parcial que incluya "pos-58" o "pos 58"
        if (!printer) {
            printer = printers.find(p => {
                const n = p.name.toLowerCase();
                return n.includes('pos-58') || n.includes('pos 58') || n.includes('pos58');
            });
        }

        // 3. Fallback a la impresora predeterminada si existe
        if (!printer) {
            printer = printers.find(p => p.isDefault);
        }

        if (!printer) {
            const list = printers.map(p => `"${p.name}"`).join(', ');
            throw new Error(`No se encontró la impresora POS-58 ni impresora predeterminada. Impresoras detectadas: ${list}`);
        }

        console.log(`[Printer] Destino de impresión: "${printer.name}" (Default: ${!!printer.isDefault})`);

        // =========================================================================
        // MÉTODO 1: Impresión Directa RAW ESC/POS (Óptima y definitiva para POS-58)
        // =========================================================================
        try {
            const ticketData = (typeof ticketInput === 'object') ? ticketInput : null;
            if (ticketData) {
                console.log('[Printer] Generando comandos nativos RAW ESC/POS...');
                const rawBuffer = buildEscPosTicket(ticketData);
                await sendRawToWindowsPrinter(printer.name, rawBuffer);
                console.log('[Printer] ¡Ticket impreso exitosamente vía RAW ESC/POS!');
                return { success: true, mode: 'raw_esc_pos', printerName: printer.name };
            }
        } catch (rawErr) {
            console.warn('[Printer] Falló el método directo RAW, intentando método de respaldo gráfico:', rawErr);
        }

        // =========================================================================
        // MÉTODO 2: Respaldo Gráfico Chromium (webContents.print)
        // =========================================================================
        const ticketHTML = (typeof ticketInput === 'object') ? (ticketInput.html || '') : ticketInput;
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    @page { size: 58mm auto; margin: 0; }
                    *, *:before, *:after {
                        box-sizing: border-box;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color: #000000 !important;
                    }
                    html, body {
                        width: 48mm;
                        max-width: 48mm;
                        margin: 0;
                        padding: 0;
                        background: #ffffff !important;
                        color: #000000 !important;
                        font-family: 'Courier New', Courier, monospace;
                        font-size: 11px;
                        line-height: 1.25;
                    }
                    body { padding: 0 0 4mm 0; }
                    .ticket-root { width: 100%; max-width: 48mm; margin: 0; padding: 0; display: block; }
                    .ticket-title { font-weight: bold; font-size: 13px; text-align: center; }
                    .ticket-subtitle { font-weight: bold; font-size: 12px; text-align: center; margin: 2px 0; }
                    .ticket-address { font-size: 10px; text-align: center; margin-bottom: 2px; }
                    .ticket-meta { font-size: 11px; text-align: center; }
                    .ticket-divider { border-top: 1px dashed #000000; margin: 4px 0; }
                    .ticket-total-large { font-size: 18px !important; font-weight: bold !important; display: flex; justify-content: space-between; margin: 6px 0; }
                    .ticket-payment-row { font-size: 11px; display: flex; justify-content: space-between; margin: 2px 0; }
                    .ticket-footer { text-align: center; font-weight: bold; font-size: 11px; margin-top: 6px; }
                </style>
            </head>
            <body>
                <div class="ticket-root">
                    ${ticketHTML}
                </div>
            </body>
            </html>
        `;

        const tempFilePath = path.join(os.tmpdir(), `ticket_fallback_${Date.now()}.html`);
        fs.writeFileSync(tempFilePath, html, 'utf-8');

        const printWindow = new BrowserWindow({
            width: 320,
            height: 600,
            show: false,
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true
            }
        });

        try {
            await printWindow.loadFile(tempFilePath);
            await printWindow.webContents.executeJavaScript(`
                new Promise(resolve => {
                    if (document.readyState === 'complete') {
                        requestAnimationFrame(() => requestAnimationFrame(resolve));
                    } else {
                        window.addEventListener('load', () => {
                            requestAnimationFrame(() => requestAnimationFrame(resolve));
                        });
                    }
                })
            `);
            await new Promise(resolve => setTimeout(resolve, 500));

            await new Promise((resolve, reject) => {
                printWindow.webContents.print({
                    silent: true,
                    deviceName: printer.name,
                    color: false,
                    printBackground: false,
                    margins: { marginType: 'none' }
                }, (success, failureReason) => {
                    if (success) resolve();
                    else reject(new Error(failureReason || 'Error al imprimir'));
                });
            });

            setTimeout(() => {
                try {
                    if (!printWindow.isDestroyed()) printWindow.close();
                    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                } catch (e) {}
            }, 3000);

            return { success: true, mode: 'gdi_graphic', printerName: printer.name };

        } catch (gdiErr) {
            if (!printWindow.isDestroyed()) printWindow.close();
            if (fs.existsSync(tempFilePath)) {
                try { fs.unlinkSync(tempFilePath); } catch (e) {}
            }
            throw gdiErr;
        }
    });

}

module.exports = { registerPrinterHandlers, buildEscPosTicket, getCashierDisplayName };
