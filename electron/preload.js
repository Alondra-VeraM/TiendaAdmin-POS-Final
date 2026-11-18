const { contextBridge, ipcRenderer } = require('electron');

// 1. Cargar el preload original de Capacitor si existe
if (process.env.CAPACITOR_PRELOAD_PATH) {
    try {
        require(process.env.CAPACITOR_PRELOAD_PATH);
    } catch (err) {
        console.warn('[Preload] No se pudo cargar preload de Capacitor:', err);
    }
}

// 2. Exponer electronAPI de forma segura en el contexto del Renderer
contextBridge.exposeInMainWorld('electronAPI', {
    printTicket: (ticketHTML) => ipcRenderer.invoke('print-ticket', ticketHTML),
    getPrinters: () => ipcRenderer.invoke('get-printers')
});
