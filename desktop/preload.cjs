const { contextBridge, shell } = require('electron');

// Expose protected methods that allow the renderer process to use
// desktop-specific utilities safely without nodeIntegration.
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  openExternal: (url) => {
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
      return shell.openExternal(url);
    }
    return Promise.reject(new Error('Invalid external URL'));
  },
});
