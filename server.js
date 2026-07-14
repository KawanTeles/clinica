const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
  // Decode URL in case of special characters
  const decodedUrl = decodeURIComponent(req.url);
  const parsedUrl = new URL(decodedUrl, `http://localhost:${PORT}`);
  let filePath = parsedUrl.pathname;

  // Default to index.html
  if (filePath === '/') {
    filePath = '/index.html';
  }

  // Calculate full physical path
  let fullPath = path.join(__dirname, filePath);

  // Helper to serve file
  function serveFile(targetPath) {
    const ext = path.extname(targetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(targetPath, (err, content) => {
      if (err) {
        // Just in case, return 500
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Internal Server Error: ${err.code}`);
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  }

  // Check if file exists
  fs.stat(fullPath, (err, stats) => {
    if (!err && stats.isFile()) {
      serveFile(fullPath);
      return;
    }

    // Elegant URLs support: if they request /pages/sobre, look for /pages/sobre.html
    if (err || !stats.isFile()) {
      const htmlPath = fullPath + '.html';
      fs.stat(htmlPath, (htmlErr, htmlStats) => {
        if (!htmlErr && htmlStats.isFile()) {
          serveFile(htmlPath);
          return;
        }

        // Return custom 404 page if it exists
        const custom404 = path.join(__dirname, 'pages', '404.html');
        fs.stat(custom404, (err404, stats404) => {
          if (!err404 && stats404.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            fs.readFile(custom404, (read404Err, content404) => {
              res.end(content404, 'utf-8');
            });
          } else {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Page Not Found - 404');
          }
        });
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`\x1b[32m%s\x1b[0m`, `[Clinica Zoe] Dev server running at http://localhost:${PORT}`);
  console.log(`Press Ctrl+C to stop the server.`);
});
