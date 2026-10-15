// Minimal local server mimicking Vercel: static files from public/ and functions from api/.
const http = require('http');
const fs = require('fs');
const path = require('path');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    const file = path.join(__dirname, 'api', path.basename(url.pathname) + '.js');
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
    return require(file)(req, res);
  }
  const file = path.join(__dirname, 'public', url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
  if (!file.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(file)) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log('http://localhost:' + (process.env.PORT || 3000)));
