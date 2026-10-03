/**
 * AI Dancing Voice Clone & Audio Proxy Handler for Node.js
 * Compatible with both Vite Dev Server and Electron Production Server.
 */

const sessions = new Map();
const sampleCache = new Map();

// Clean up sessions and sample audio cache older than 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of sessions.entries()) {
    if (now - val.createdAt > 30 * 60 * 1000) {
      sessions.delete(key);
    }
  }
  for (const [key, val] of sampleCache.entries()) {
    if (now - val.createdAt > 30 * 60 * 1000) {
      sampleCache.delete(key);
    }
  }
}, 10 * 60 * 1000).unref?.();

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) {
        reject(new Error('Request payload too large'));
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function handleAiDancingServerRequest(req, res) {
  const urlStr = req.url || '';
  if (
    !urlStr.startsWith('/api/aidancing/clone') &&
    !urlStr.startsWith('/api/aidancing/status') &&
    !urlStr.startsWith('/api/aidancing/download') &&
    !urlStr.startsWith('/api/audio-proxy')
  ) {
    return false;
  }

  const parsedUrl = new URL(urlStr, 'http://localhost');
  const pathname = parsedUrl.pathname;

  // 1. Audio Proxy: stream any remote audio without CORS or COEP restrictions
  if (pathname === '/api/audio-proxy' && req.method === 'GET') {
    const targetUrl = parsedUrl.searchParams.get('url');
    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing or invalid "url" query param' }));
      return true;
    }

    try {
      const audioRes = await fetch(targetUrl, {
        headers: { 'User-Agent': 'voice-api-client/1.0' },
      });
      if (!audioRes.ok) {
        res.writeHead(audioRes.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Không thể tải audio từ URL nguồn (${audioRes.status})` }));
        return true;
      }
      const buf = await audioRes.arrayBuffer();
      res.writeHead(200, {
        'Content-Type': audioRes.headers.get('content-type') || 'audio/mpeg',
        'Content-Length': buf.byteLength,
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Cache-Control': 'public, max-age=86400',
      });
      res.end(Buffer.from(buf));
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Lỗi kết nối khi tải audio: ${err.message}` }));
    }
    return true;
  }

  // 2. Clone initialization
  if (pathname === '/api/aidancing/clone' && req.method === 'POST') {
    try {
      const rawBody = await readBody(req);
      const { text, previewUrl, voiceIndex } = JSON.parse(rawBody || '{}');
      const trimmedText = typeof text === 'string' ? text.trim() : '';

      if (!trimmedText) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Văn bản không được để trống' }));
        return true;
      }

      let sampleBuf = null;
      if (previewUrl && typeof previewUrl === 'string' && previewUrl.startsWith('http')) {
        const cached = sampleCache.get(previewUrl);
        if (cached && Date.now() - cached.createdAt < 30 * 60 * 1000) {
          sampleBuf = cached.buffer;
        } else {
          let sampleRes = await fetch(previewUrl, {
            headers: { 'User-Agent': 'voice-api-client/1.0' },
          }).catch(() => null);

          // If the preview audio URL returned 404 or failed, fallback to a verified live sample
          if (!sampleRes || !sampleRes.ok) {
            const fallbackUrl = 'https://cdn.hailuoai.video/open-hailuo-video-web/public_assets/dc8888e4-6091-429b-8111-8f7f1bfa4c9f.mp3';
            sampleRes = await fetch(fallbackUrl, {
              headers: { 'User-Agent': 'voice-api-client/1.0' },
            }).catch(() => null);
          }

          if (!sampleRes || !sampleRes.ok) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Không thể tải file nghe thử mẫu (${sampleRes ? sampleRes.status : 500})` }));
            return true;
          }
          sampleBuf = await sampleRes.arrayBuffer();
          sampleCache.set(previewUrl, { buffer: sampleBuf, createdAt: Date.now() });
        }
      }

      const payload = { text: trimmedText, lang: 'vi' };
      if (!sampleBuf && voiceIndex !== undefined) {
        payload.voiceIndex = String(voiceIndex);
      }

      const createRes = await fetch('https://audio.aidancing.net/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'voice-api-client/1.0',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!createRes.ok) {
        const err = await createRes.text().catch(() => '');
        res.writeHead(createRes.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Lỗi khởi tạo job trên AI Dancing (${createRes.status}): ${err}` }));
        return true;
      }

      const cookieHeader = createRes.headers.get('set-cookie');
      const aafUid = (cookieHeader || '').split(';')[0];
      const { jobUid } = await createRes.json();
      if (!jobUid) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'AI Dancing không trả về jobUid hợp lệ' }));
        return true;
      }

      if (sampleBuf) {
        const fd = new FormData();
        fd.append('file', new Blob([sampleBuf], { type: 'audio/mpeg' }), 'sample.mp3');
        const uploadRes = await fetch(`https://audio.aidancing.net/jobs/${jobUid}/upload`, {
          method: 'POST',
          headers: {
            'User-Agent': 'voice-api-client/1.0',
            Accept: 'application/json',
            Cookie: aafUid,
          },
          body: fd,
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.text().catch(() => '');
          res.writeHead(uploadRes.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Lỗi upload file mẫu giọng lên AI Dancing (${uploadRes.status}): ${err}` }));
          return true;
        }
      } else {
        const startRes = await fetch(`https://audio.aidancing.net/jobs/${jobUid}/start`, {
          method: 'POST',
          headers: {
            'User-Agent': 'voice-api-client/1.0',
            Accept: 'application/json',
            Cookie: aafUid,
          },
        });
        if (!startRes.ok) {
          const err = await startRes.text().catch(() => '');
          res.writeHead(startRes.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Lỗi bắt đầu job trên AI Dancing (${startRes.status}): ${err}` }));
          return true;
        }
      }

      sessions.set(jobUid, { cookie: aafUid, createdAt: Date.now() });

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ jobUid }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Lỗi xử lý yêu cầu' }));
    }
    return true;
  }

  // 3. Status check
  if (pathname === '/api/aidancing/status' && req.method === 'GET') {
    const jobUid = parsedUrl.searchParams.get('jobUid');
    if (!jobUid) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing jobUid param' }));
      return true;
    }

    const session = sessions.get(jobUid);
    try {
      const pollRes = await fetch('https://audio.aidancing.net/jobs', {
        headers: {
          'User-Agent': 'voice-api-client/1.0',
          Accept: 'application/json',
          ...(session ? { Cookie: session.cookie } : {}),
        },
      });

      if (!pollRes.ok) {
        res.writeHead(pollRes.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Lỗi polling status (${pollRes.status})` }));
        return true;
      }

      const jobs = await pollRes.json();
      const cur = Array.isArray(jobs) ? jobs.find((j) => (j.uid || j.jobUid || j.id) === jobUid) : null;
      if (!cur) {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({ status: 'PENDING' }));
        return true;
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(
        JSON.stringify({
          status: (cur.status || '').toUpperCase(),
          outputUrl: cur.outputUrl || null,
          error: cur.error || null,
        }),
      );
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Lỗi polling status' }));
    }
    return true;
  }

  // 4. Download result
  if (pathname === '/api/aidancing/download' && req.method === 'GET') {
    const jobUid = parsedUrl.searchParams.get('jobUid');
    const outputUrl = parsedUrl.searchParams.get('outputUrl');
    if (!outputUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing outputUrl param' }));
      return true;
    }

    const session = jobUid ? sessions.get(jobUid) : null;
    const fullUrl = outputUrl.startsWith('http')
      ? outputUrl
      : `https://audio.aidancing.net${outputUrl.startsWith('/') ? '' : '/'}${outputUrl}`;

    try {
      const fileRes = await fetch(fullUrl, {
        headers: {
          'User-Agent': 'voice-api-client/1.0',
          ...(session ? { Cookie: session.cookie } : {}),
        },
      });

      if (!fileRes.ok) {
        res.writeHead(fileRes.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Không thể tải file kết quả (${fileRes.status})` }));
        return true;
      }

      const buf = await fileRes.arrayBuffer();
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buf.byteLength,
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      });
      res.end(Buffer.from(buf));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Lỗi tải file kết quả' }));
    }
    return true;
  }

  return false;
}

module.exports = {
  handleAiDancingServerRequest,
};
