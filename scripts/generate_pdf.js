/**
 * Generate PDF using Chrome CDP Page.printToPDF
 * Native Node 24 WebSocket (Zero External Dependencies)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const defaultInput = path.resolve(__dirname, '..', 'docs', 'DOSSIE_LEGAL_E_CLINICO_CLINPGX.html');
const defaultOutput = path.resolve(__dirname, '..', 'docs', 'DOSSIE_LEGAL_E_CLINICO_CLINPGX.pdf');

const HTML_FILE = process.argv[2] ? path.resolve(process.argv[2]) : defaultInput;
const PDF_FILE = process.argv[3] ? path.resolve(process.argv[3]) : defaultOutput;

async function printPdf() {
  console.log(`Compilando PDF a partir de: ${HTML_FILE}`);
  console.log(`Destino do PDF: ${PDF_FILE}`);

  console.log('1. Abrindo nova aba no Chrome CDP...');
  const fileUrl = 'file:///' + HTML_FILE.replace(/\\/g, '/');
  
  const target = await new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: 9222,
      path: '/json/new?' + encodeURIComponent(fileUrl),
      method: 'PUT'
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.end();
  });

  console.log(' -> Aba criada:', target.id);
  console.log(' -> Conectando WebSocket nativo:', target.webSocketDebuggerUrl);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(res => ws.onopen = res);

  let idCounter = 1;
  function sendCdp(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = idCounter++;
      const onMsg = (event) => {
        const data = JSON.parse(event.data);
        if (data.id === msgId) {
          ws.removeEventListener('message', onMsg);
          if (data.error) reject(new Error(data.error.message));
          else resolve(data.result);
        }
      };
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  console.log('2. Habilitando domínio Page e aguardando renderização...');
  await sendCdp('Page.enable');
  await new Promise(r => setTimeout(r, 1200)); // Espera carregar fontes e render

  console.log('3. Invocando Page.printToPDF...');
  const pdfResult = await sendCdp('Page.printToPDF', {
    printBackground: true,
    paperWidth: 8.27, // A4 width in inches
    paperHeight: 11.69, // A4 height in inches
    marginTop: 0.35,
    marginBottom: 0.35,
    marginLeft: 0.35,
    marginRight: 0.35,
    preferCSSPageSize: true
  });

  console.log('4. Gravando arquivo PDF em disco...');
  const buffer = Buffer.from(pdfResult.data, 'base64');
  fs.writeFileSync(PDF_FILE, buffer);
  console.log(` -> PDF gravado com sucesso em: ${PDF_FILE}`);
  console.log(` -> Tamanho: ${(buffer.length / 1024).toFixed(1)} KB`);

  console.log('5. Fechando aba temporária do Chrome...');
  ws.close();
  await new Promise((resolve) => {
    const req = http.request({
      host: '127.0.0.1',
      port: 9222,
      path: '/json/close/' + target.id,
      method: 'GET'
    }, () => resolve());
    req.end();
  });

  console.log('Concluído com sucesso!');
}

printPdf().catch(err => {
  console.error('Erro ao gerar PDF:', err);
  process.exit(1);
});
