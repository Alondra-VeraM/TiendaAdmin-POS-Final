/**
 * GESTOR DEL SERVIDOR LOCAL BACKEND (serverManager.js)
 * Verifica si el backend maestro en el puerto 3000 está activo.
 * Si no está activo, lo inicia automáticamente en segundo plano para que
 * Electron cuente con todos los servicios locales (SQLite, turnos, CFDI, sync).
 */

const path = require('path');
const fs = require('fs');
const net = require('net');
const { fork } = require('child_process');
const { app } = require('electron');

let serverProcess = null;

/**
 * Verifica si un puerto ya está siendo utilizado por un proceso
 */
function isPortOpen(port = 3000, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(400);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true); // El puerto está abierto y respondiendo
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

/**
 * Inicia automáticamente server.js en segundo plano si no está corriendo
 */
async function startBackendServer() {
  try {
    const alreadyRunning = await isPortOpen(3000);
    if (alreadyRunning) {
      console.log('[ServerManager] Backend local en puerto 3000 ya se encuentra en ejecución.');
      return;
    }

    // Buscar la ruta de server.js
    const candidates = [
      path.join(__dirname, '../../server.js'),
      path.join(process.cwd(), 'server.js'),
      path.join(app.getAppPath(), '../server.js'),
      path.join(app.getAppPath(), '../../server.js')
    ];

    const serverScript = candidates.find(p => fs.existsSync(p));
    if (!serverScript) {
      console.warn('[ServerManager] No se encontró server.js en las rutas esperadas:', candidates);
      return;
    }

    const projectRoot = path.dirname(serverScript);
    console.log('[ServerManager] Iniciando backend local automáticamente en background:', serverScript);

    serverProcess = fork(serverScript, [], {
      cwd: projectRoot,
      env: { ...process.env, PORT: '3000' },
      stdio: 'inherit'
    });

    serverProcess.on('exit', (code, signal) => {
      console.log(`[ServerManager] Backend local finalizó (código: ${code}, señal: ${signal})`);
      serverProcess = null;
    });

    // Asegurar detención del backend al cerrar la app
    app.on('before-quit', () => {
      if (serverProcess) {
        console.log('[ServerManager] Deteniendo backend local al salir...');
        try {
          serverProcess.kill();
        } catch (e) {}
        serverProcess = null;
      }
    });

    app.on('will-quit', () => {
      if (serverProcess) {
        try {
          serverProcess.kill();
        } catch (e) {}
        serverProcess = null;
      }
    });

  } catch (err) {
    console.error('[ServerManager] Error al verificar/iniciar backend local:', err);
  }
}

module.exports = { startBackendServer, isPortOpen };
