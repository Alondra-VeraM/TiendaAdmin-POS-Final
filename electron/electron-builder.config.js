/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.pos.retail',
  productName: 'Lector POS',
  directories: {
    output: 'dist',
    buildResources: 'assets',
  },
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] }
    ]
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Lector POS',
    runAfterFinish: false
  },
  files: [
    'build/**/*',
    'app/**/*',
    'generated/**/*',
    // `assets` is also the electron-builder `buildResources` directory, whose
    // contents are NOT packaged by default. Include it explicitly so the
    // splash screen (and any other runtime assets) ship in the app.
    'assets/**/*',
    'modules/**/*',
    'preload.js',
    'package.json',
    // Platform runtime + plugins, prepared by `capacitor-electron vendor`.
    { from: 'vendor/node_modules', to: 'node_modules' },
  ],
  extraResources: [
    { from: '../server.js', to: 'backend/server.js' },
    { from: '../database', to: 'backend/database', filter: ['**/*', '!backups/**', '!*.sqlite*'] },
    { from: '../routes', to: 'backend/routes' },
    { from: '../controllers', to: 'backend/controllers' },
    { from: '../node_modules', to: 'backend/node_modules' },
    { from: 'modules/printer.js', to: 'backend/electron/modules/printer.js' },
    { from: '../.env', to: 'backend/.env' }
  ]
};
