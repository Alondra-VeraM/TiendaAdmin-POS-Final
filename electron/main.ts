import { createCapacitorElectronApp } from '@capawesome/capacitor-electron';

import config from './capacitor.electron.config';

const { startBackendServer } = require('../modules/serverManager.js');
const { registerPrinterHandlers } = require('../modules/printer.js');

// 1. Iniciar servidor local backend (puerto 3000) si no está activo
startBackendServer();

// 2. Iniciar runtime de Capacitor en Electron
createCapacitorElectronApp(config);

// 3. Registrar controladores de impresión directa de tickets
registerPrinterHandlers();
