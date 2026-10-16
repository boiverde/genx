const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8088;
const PROTOTYPE_FILE = path.resolve(__dirname, '..', 'prototipo', 'prototype-clinpgx.html');

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url.startsWith('/prototype')) {
    fs.readFile(PROTOTYPE_FILE, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Erro ao ler protótipo: ' + err.message);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ClinPGx Prototype Server running at http://127.0.0.1:${PORT}/`);
});
