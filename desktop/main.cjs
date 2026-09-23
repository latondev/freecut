const { app, BrowserWindow, Menu, shell, session, screen, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// 1. Single Instance Lock - Ensure only one instance of FreeCut runs
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// 2. Hardware Acceleration & High-Performance Discrete GPU Flags
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer,VaapiVideoDecoder,WebCodecs,FileSystemAccessPersistentPermissions');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('gpu-preference', '2');

// Auto-register executable in Windows DirectX Graphics Settings for High-Performance Discrete GPU
function registerWindowsGpuPreference() {
  if (process.platform !== 'win32') return;
  try {
    const { exec } = require('child_process');
    const exePath = app.isPackaged ? process.execPath : path.resolve('node_modules/electron/dist/electron.exe');
    const regCmd = `reg add "HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences" /v "${exePath}" /t REG_SZ /d "GpuPreference=2;" /f`;
    exec(regCmd, () => {});
  } catch (e) {
    // Non-fatal
  }
}
registerWindowsGpuPreference();

const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
let mainWindow = null;
let localServer = null;

// Window State Management (Remember position & size)
const stateFilePath = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  const defaultState = { width: 1440, height: 900, isMaximized: true };
  try {
    if (fs.existsSync(stateFilePath)) {
      const parsed = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
      // Validate that the saved position is still within visible display bounds
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        const displays = screen.getAllDisplays();
        const isVisible = displays.some((display) => {
          const { x, y, width, height } = display.bounds;
          return (
            parsed.x >= x &&
            parsed.x < x + width &&
            parsed.y >= y &&
            parsed.y < y + height
          );
        });
        if (!isVisible) {
          delete parsed.x;
          delete parsed.y;
        }
      }
      return { ...defaultState, ...parsed };
    }
  } catch (e) {
    console.warn('[Desktop] Could not load window state, using defaults.');
  }
  return defaultState;
}

function saveWindowState(window) {
  if (!window || window.isDestroyed()) return;
  try {
    const isMaximized = window.isMaximized();
    const bounds = window.getNormalBounds();
    const state = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized,
    };
    fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    // Ignore write failures during shutdown
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

function startLocalServer(distDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const decodedUrl = decodeURI((req.url || '/').split('?')[0]);
        const ext = path.extname(decodedUrl).toLowerCase();
        let filePath = path.join(distDir, decodedUrl);

        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        }

        // SPA fallback: redirect route paths without file extension to index.html
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          if (!ext || ext === '.html' || (req.headers.accept && req.headers.accept.includes('text/html'))) {
            filePath = path.join(distDir, 'index.html');
          }
        }

        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('File Not Found');
          return;
        }

        const stat = fs.statSync(filePath);
        const finalExt = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[finalExt] || 'application/octet-stream';

        // Cache-control: Immutable long cache for hashed assets, no-cache for HTML
        const isHashedAsset = decodedUrl.startsWith('/assets/') && finalExt !== '.html';
        const cacheControl = isHashedAsset
          ? 'public, max-age=31536000, immutable'
          : 'no-cache, must-revalidate';

        const headers = {
          'Content-Type': contentType,
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
          'Access-Control-Allow-Origin': '*',
          'Document-Policy': 'js-profiling',
          'Accept-Ranges': 'bytes',
          'Cache-Control': cacheControl,
        };

        const range = req.headers.range;
        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

          if (start >= stat.size || end >= stat.size || start > end) {
            res.writeHead(416, {
              ...headers,
              'Content-Range': `bytes */${stat.size}`,
            });
            return res.end();
          }

          const chunkSize = end - start + 1;
          const stream = fs.createReadStream(filePath, { start, end });
          res.writeHead(206, {
            ...headers,
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Content-Length': chunkSize,
          });
          stream.pipe(res);
        } else {
          res.writeHead(200, {
            ...headers,
            'Content-Length': stat.size,
          });
          fs.createReadStream(filePath).pipe(res);
        }
      } catch (err) {
        console.error('Server error handling request:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    });

    const PREFERRED_PORT = 24678;
    server.listen(PREFERRED_PORT, '127.0.0.1', () => {
      resolve({ server, port: PREFERRED_PORT });
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[Desktop] Port ${PREFERRED_PORT} in use, picking random open port.`);
        server.listen(0, '127.0.0.1', () => {
          const address = server.address();
          resolve({ server, port: address.port });
        });
      } else {
        reject(err);
      }
    });
  });
}

function buildMenu() {
  const template = [
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          },
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen', accelerator: 'F11' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'FreeCut GitHub',
          click: async () => {
            await shell.openExternal('https://github.com/latondev/freecut');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function createWindow() {
  buildMenu();

  const iconPath = path.join(__dirname, '../public/icons/icon-512.png');
  const windowState = loadWindowState();

  mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: 1024,
    minHeight: 600,
    title: 'FreeCut - Video Editor',
    backgroundColor: '#0f172a',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (windowState.isMaximized) {
      mainWindow.maximize();
    }
    mainWindow.show();
  });

  // Debounce save window state on move / resize
  let resizeTimeout = null;
  const debouncedSaveState = () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      saveWindowState(mainWindow);
    }, 500);
  };

  mainWindow.on('resize', debouncedSaveState);
  mainWindow.on('move', debouncedSaveState);
  mainWindow.on('close', () => {
    saveWindowState(mainWindow);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Open external links in user's default browser
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (isDev) {
    const devUrl = 'http://localhost:5173/projects';
    console.log(`[Desktop] Loading Vite Dev Server: ${devUrl}`);
    await mainWindow.loadURL(devUrl);
  } else {
    const distDir = path.join(__dirname, '../dist');
    if (!fs.existsSync(path.join(distDir, 'index.html'))) {
      console.error(`[Desktop] Error: dist/index.html not found at ${distDir}. Please run build first.`);
      process.exit(1);
    }

    const { server, port } = await startLocalServer(distDir);
    localServer = server;
    const targetUrl = `http://127.0.0.1:${port}/projects`;
    console.log(`[Desktop] Serving FreeCut desktop runtime on: ${targetUrl}`);
    await mainWindow.loadURL(targetUrl);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// When a second instance is launched, focus the existing window
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  // Auto-approve permission requests (including File System Access API)
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });
  session.defaultSession.setPermissionCheckHandler(() => true);
  session.defaultSession.setDevicePermissionHandler(() => true);

  // Handle auto-reconnect requests from renderer with userGesture context
  ipcMain.handle('freecut:request-user-gesture-reconnect', async (event) => {
    const sender = event.sender;
    if (!sender || sender.isDestroyed()) return false;
    try {
      return await sender.executeJavaScript(`
        (async () => {
          if (typeof window.__freecut_do_reconnect__ === 'function') {
            return await window.__freecut_do_reconnect__();
          }
          return false;
        })()
      `, true /* userGesture = true */);
    } catch (err) {
      console.warn('[Desktop] Auto-reconnect with userGesture failed:', err);
      return false;
    }
  });

  // Ensure headers for any internal interceptor
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    responseHeaders['Cross-Origin-Opener-Policy'] = ['same-origin'];
    responseHeaders['Cross-Origin-Embedder-Policy'] = ['require-corp'];
    callback({ responseHeaders });
  });

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (localServer) {
    localServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
