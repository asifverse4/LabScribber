const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

let mainWindow;
let splashWindow;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 440,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.center();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#09090b', // Deep charcoal style matching the user's Dark Workspace
    title: 'Labscribber Scientific Spectroscopy Workspace',
    icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    autoHideMenuBar: true, // Smooth title border, no redundant browser menus
    show: false, // Hold the window hidden until content has finished painting
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: true
    }
  });

  // Load appropriate source based on mode
  const devUrl = process.env.ELECTRON_DEV_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
    // Open devtools automatically in dev mode for easy diagnostics
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Swap from splash to main window once the first frame has actually painted,
  // so users never see a blank/white flash between the two windows.
  mainWindow.once('ready-to-show', () => {
    const MIN_SPLASH_MS = 1900; // let the draw-in animation finish before swapping
    const elapsed = Date.now() - splashStartedAt;
    const remaining = Math.max(MIN_SPLASH_MS - elapsed, 0);
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      mainWindow.show();
    }, remaining);
  });

  // Intercept hyperlinks and pass them to standard default system browsers instead of inside Electron frame
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let splashStartedAt = 0;

app.whenReady().then(() => {
  splashStartedAt = Date.now();
  createSplashWindow();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
