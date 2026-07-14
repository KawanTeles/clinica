const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.pdf':  'application/pdf',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.eot':  'application/vnd.ms-fontobject',
  '.otf':  'font/otf',
  '.wasm': 'application/wasm'
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error: ' + err.code);
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

function serve404(res) {
  const custom404 = path.join(ROOT, 'pages', '404.html');
  fs.stat(custom404, (err) => {
    if (!err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.readFile(custom404, (readErr, content) => {
        res.end(content || 'Not Found');
      });
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 - Page Not Found');
    }
  });
}

const server = http.createServer((req, res) => {
  // --- Cabeçalhos CORS para desenvolvimento ---
  res.setHeader('Access-Control-Allow-Origin', '*');

  let rawPath;
  try {
    // Decodifica a URL com segurança
    const decodedUrl = decodeURIComponent(req.url.split('?')[0]);
    const parsed = new URL(decodedUrl, `http://localhost:${PORT}`);
    rawPath = parsed.pathname;
  } catch (e) {
    // URL totalmente inválida
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('400 - Bad Request: Invalid URL');
    return;
  }

  // Página raiz → index.html
  if (rawPath === '/') rawPath = '/index.html';

  // Calcular caminho físico e prevenir path traversal
  const fullPath = path.normalize(path.join(ROOT, rawPath));
  if (!fullPath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 - Forbidden');
    return;
  }

  // Ignorar favicon silenciosamente se não existir
  if (rawPath === '/favicon.ico') {
    fs.stat(fullPath, (err) => {
      if (err) {
        res.writeHead(204);
        res.end();
      } else {
        serveFile(res, fullPath);
      }
    });
    return;
  }

  // Tentar servir o arquivo diretamente
  fs.stat(fullPath, (err, stats) => {
    if (!err && stats.isFile()) {
      serveFile(res, fullPath);
      return;
    }

    // Pretty URLs: /pages/sobre → /pages/sobre.html
    const htmlPath = fullPath + '.html';
    fs.stat(htmlPath, (htmlErr, htmlStats) => {
      if (!htmlErr && htmlStats.isFile()) {
        serveFile(res, htmlPath);
        return;
      }

      // Diretório com index.html
      const indexPath = path.join(fullPath, 'index.html');
      fs.stat(indexPath, (idxErr, idxStats) => {
        if (!idxErr && idxStats.isFile()) {
          serveFile(res, indexPath);
          return;
        }
        serve404(res);
      });
    });
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\x1b[31m[Erro] Porta ${PORT} já está em uso. Feche o processo anterior e tente novamente.\x1b[0m`);
  } else {
    console.error('[Erro no servidor]', err.message);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`\x1b[32m✔ Clínica Zoe — servidor rodando em http://localhost:${PORT}\x1b[0m`);
  console.log(`  Pressione Ctrl+C para parar.\n`);
});
