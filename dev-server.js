// dev-server.js - CJS version
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

async function loadEnvLocal() {
  try {
    const envPath = path.join(ROOT, '.env.local');
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  } catch (_) {}
}

async function runApiRoute(apiPath, req, res) {
  const scriptPath = path.join(ROOT, 'api', apiPath);
  console.log('[api] Requested:', apiPath, '->', scriptPath);
  
  if (!fs.existsSync(scriptPath)) {
    console.log('[api] File not found:', scriptPath);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  // Load the script using createRequire (supports CommonJS)
  try {
    console.log('[api] Attempting to load...');
    const requireFromFile = createRequire(scriptPath);
    // Clear require cache to pick up changes
    const resolvedPath = requireFromFile.resolve(scriptPath);
    delete require.cache[resolvedPath];
    const handler = requireFromFile(scriptPath);
    console.log('[api] Loaded handler, type:', typeof handler);
    
    // Collect body
    let body = '';
    for await (const chunk of req) body += chunk;
    
    // Create mock req/res objects compatible with Vercel API
    const mockReq = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: {},
      body: body ? JSON.parse(body) : null,
    };

    let statusCode = 200;
    const headers = {};
    let responseSent = false;

    const mockRes = {
      statusCode: 200,
      setHeader: (k, v) => { headers[k] = String(v); },
      getHeader: (k) => headers[k],
      removeHeader: (k) => { delete headers[k]; },
      getHeaderNames: () => Object.keys(headers),
      getHeaders: () => ({ ...headers }),
      hasHeader: (k) => k in headers,
      writeHead: (code, hdrs) => {
        statusCode = code;
        if (hdrs) Object.assign(headers, hdrs);
      },
      write: (data) => { mockRes._chunks = mockRes._chunks || []; mockRes._chunks.push(data); return true; },
      end: (data) => {
        if (data) { mockRes._chunks = mockRes._chunks || []; mockRes._chunks.push(data); }
        responseSent = true;
        const body = (mockRes._chunks || []).join('');
        res.writeHead(statusCode, headers);
        res.end(body);
      },
      json: (data) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      },
      status: (code) => {
        mockRes.statusCode = code;
        return mockRes;
      },
      send: (data) => {
        res.writeHead(statusCode, headers);
        res.end(typeof data === 'string' ? data : JSON.stringify(data));
      },
    };

    await handler(mockReq, mockRes);
  } catch (err) {
    console.error('[api] Error:', err.message);
    console.error(err.stack);
    if (!responseSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  }
}

async function serveStatic(filePath, res) {
  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

loadEnvLocal().then(() => {
  const server = http.createServer(async (req, res) => {
    const urlPath = req.url.split('?')[0];
    console.log('[server] Request:', req.method, urlPath);

    // API routes
    if (urlPath.startsWith('/api/')) {
      console.log('[server] API route detected');
      const apiPath = urlPath.slice('/api/'.length);
      await runApiRoute(apiPath, req, res);
      return;
    }

    // Static files
    let filePath = path.join(ROOT, urlPath);
    if (urlPath === '/' || urlPath === '') {
      filePath = path.join(ROOT, 'index.html');
    }

    // Security: prevent directory traversal
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    // If directory, try index.html
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    await serveStatic(filePath, res);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Dev server listening on http://0.0.0.0:${PORT}`);
  });
});
