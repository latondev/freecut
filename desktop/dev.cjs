const { spawn, spawnSync } = require('child_process');
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
  shell: isWindows,
});

let isShuttingDown = false;
let electronProcess = null;

function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (isWindows) {
      spawnSync('taskkill', ['/pid', pid.toString(), '/f', '/t'], { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch (e) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch (_) {}
  }
}

function cleanupAndExit(code = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('🛑 [FreeCut Dev] Đang dừng Dev Server và thoát...');

  if (electronProcess && electronProcess.pid) {
    killProcessTree(electronProcess.pid);
  }
  if (viteProcess && viteProcess.pid) {
    killProcessTree(viteProcess.pid);
  }
  process.exit(code);
}

process.on('SIGINT', () => cleanupAndExit(0));
process.on('SIGTERM', () => cleanupAndExit(0));

waitForServer('http://localhost:5173')
  .then(() => {
    console.log('⚡ [FreeCut Dev] Dev server đã sẵn sàng! Đang mở cửa sổ Desktop GUI...');
    electronProcess = spawn(npxCmd, ['electron', '.', '--dev'], {
      stdio: 'inherit',
      shell: isWindows,
    });

    electronProcess.on('close', (code) => {
      console.log('🛑 [FreeCut Dev] Cửa sổ Desktop đã đóng.');
      cleanupAndExit(code || 0);
    });

    electronProcess.on('error', (err) => {
      console.error('❌ [FreeCut Dev] Lỗi mở Desktop GUI:', err.message);
      cleanupAndExit(1);
    });
  })
  .catch((err) => {
    console.error('❌ [FreeCut Dev] Lỗi:', err.message);
    cleanupAndExit(1);
  });

