const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');
const net = require('node:net');

function findFreePort(preferredPort = 3000) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', () => {
      const fallback = net.createServer();
      fallback.unref();
      fallback.listen(0, '127.0.0.1', () => {
        const addr = fallback.address();
        fallback.close(() => resolve(addr.port));
      });
    });
    srv.listen(preferredPort, '127.0.0.1', () => {
      const addr = srv.address();
      srv.close(() => resolve(addr.port));
    });
  });
}

async function waitForServer(url, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/api/compiler/status`);
      if (res.ok) return;
    } catch {
      // retry until Express binds
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}

async function createWindow() {
  const port = await findFreePort(3000);
  process.env.PORT = String(port);
  const isPackaged = app.isPackaged;
  if (isPackaged) {
    process.env.NODE_ENV = 'production';
  }
  const distDir = isPackaged && process.resourcesPath
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dist')
    : path.join(__dirname, '..', 'dist');

  process.env.TEXCELLENT_DIST_DIR = distDir;
  process.env.TEXMATCH_DIST_DIR = distDir;

  const serverPath = isPackaged && process.resourcesPath
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dist-server', 'server.cjs')
    : path.join(__dirname, '..', 'dist-server', 'server.cjs');

  try {
    require(serverPath);
  } catch {
    require(path.join(__dirname, '..', 'dist-server', 'server.cjs'));
  }

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(baseUrl);

  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    title: 'TeXcellent',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(baseUrl)) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await win.loadURL(baseUrl);
}

app.whenReady().then(() => {
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
