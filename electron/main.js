const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { URL } = require('url');

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const win = new BrowserWindow({
    title: 'Trios\u00ae',
    icon: path.join(__dirname, '..', 'build', 'Icon.ico'),

    // Start maximized; can be resized/moved but not minimized
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,

    // Remove default minimize button behavior
    minimizable: false,

    // Keep a clean frameless-style title bar on Windows
    frame: true,
    show: false,

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Launch maximized
  win.maximize();

  // Show once ready to avoid flash
  win.once('ready-to-show', () => {
    win.show();
  });

  // Suppress the native minimize (belt-and-suspenders)
  win.on('minimize', (e) => {
    e.preventDefault();
  });

  // Block external navigation (security)
  win.webContents.setWindowOpenHandler(({ url }) => {
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    const appUrl = isDev ? 'http://localhost:5173' : `file://`;
    if (!url.startsWith(isDev ? 'http://localhost:5173' : `file://`)) {
      event.preventDefault();
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    // win.webContents.openDevTools(); // uncomment to debug
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  // Remove the default application menu (File, Edit, View, Window, Help)
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
