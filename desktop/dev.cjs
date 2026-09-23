const { spawn } = require('child_process');
const http = require('http');

function waitForServer(url, timeout = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeout) {
          reject(new Error('Timeout waiting for dev server at ' + url));
        } else {
          setTimeout(check, 300);
        }
      });
      req.setTimeout(1000, () => {
        req.destroy();
        setTimeout(check, 300);
      });
    };
    check();
  });
}

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

console.log('🚀 [FreeCut Dev] Đang khởi động Vite Dev Server...');

const viteProcess = spawn(npmCmd, ['run', 'dev'], {
  stdio: 'inherit',
  shell: true,
});

waitForServer('http://localhost:5173')
  .then(() => {
    console.log('⚡ [FreeCut Dev] Dev server đã sẵn sàng! Đang mở cửa sổ Desktop GUI...');
    const electronProcess = spawn(npxCmd, ['electron', '.', '--dev'], {
      stdio: 'inherit',
      shell: true,
    });

    electronProcess.on('close', (code) => {
      console.log('🛑 [FreeCut Dev] Cửa sổ Desktop đã đóng. Đang dừng Dev Server...');
      try {
        if (isWindows && viteProcess.pid) {
          spawn('taskkill', ['/pid', viteProcess.pid.toString(), '/f', '/t']);
        } else {
          viteProcess.kill();
        }
      } catch (e) {
        // ignore
      }
      process.exit(code || 0);
    });
  })
  .catch((err) => {
    console.error('❌ [FreeCut Dev] Lỗi:', err.message);
    try {
      if (isWindows && viteProcess.pid) {
        spawn('taskkill', ['/pid', viteProcess.pid.toString(), '/f', '/t']);
      } else {
        viteProcess.kill();
      }
    } catch (e) {
      // ignore
    }
    process.exit(1);
  });
