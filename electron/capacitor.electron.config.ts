import { defineConfig } from '@capawesome/capacitor-electron/config';
import { BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export default defineConfig({
  scheme: 'capacitor-electron',
  hostname: 'localhost',
  window: {
    width: 1200,
    height: 800,
  },
  
  csp: {
    policy: [
      "default-src 'self' capacitor-electron: data: blob:",
      "script-src 'self' 'unsafe-inline' capacitor-electron: https:",
      "style-src 'self' 'unsafe-inline' capacitor-electron: https://fonts.googleapis.com https:",
      "font-src 'self' data: capacitor-electron: https://fonts.gstatic.com https:",
      "img-src 'self' data: blob: capacitor-electron: https: http:",
      "media-src 'self' blob: capacitor-electron: data:",
      "connect-src 'self' capacitor-electron: http: https: ws: wss:",
      "object-src 'none'",
      "frame-src 'self' blob: data:",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
    devPolicy: [
      "default-src 'self' capacitor-electron: data: blob:",
      "script-src 'self' 'unsafe-inline' capacitor-electron: https:",
      "style-src 'self' 'unsafe-inline' capacitor-electron: https://fonts.googleapis.com https:",
      "font-src 'self' data: capacitor-electron: https://fonts.gstatic.com https:",
      "img-src 'self' data: blob: capacitor-electron: https: http:",
      "media-src 'self' blob: capacitor-electron: data:",
      "connect-src 'self' capacitor-electron: http: https: ws: wss:",
      "object-src 'none'",
      "frame-src 'self' blob: data:",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },

  hooks: {
    windowFactory: (options) => {
      const capacitorPreload = options.webPreferences?.preload;
      if (capacitorPreload) {
        process.env.CAPACITOR_PRELOAD_PATH = capacitorPreload;
      }

      const candidatePaths = [
        path.join(__dirname, '../preload.js'),
        path.join(__dirname, 'preload.js'),
        path.join(process.cwd(), 'preload.js'),
        path.join(process.cwd(), 'electron/preload.js'),
      ];
      const customPreload = candidatePaths.find(p => fs.existsSync(p)) || path.join(__dirname, '../preload.js');

      if (options.webPreferences) {
        options.webPreferences.sandbox = false;
        options.webPreferences.preload = customPreload;
      }

      return new BrowserWindow(options);
    },

    onWindowCreated: (window) => {
      const origin = 'capacitor-electron://localhost';

      window.webContents.session.webRequest.onBeforeRequest(
        { urls: [`${origin}/*`] },
        (details: { url: string | URL; resourceType: string; }, callback: (arg0: { redirectURL?: string; }) => void) => {
          const url = new URL(details.url);

          if (
            details.resourceType === 'mainFrame' &&
            url.pathname === '/'
          ) {
            callback({
              redirectURL: `${origin}/pos.html`
            });
            return;
          }

          callback({});
        }
      );
    }
  }
});
