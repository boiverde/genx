const http = require('http');

(async () => {
  const targets = await new Promise(r => http.get('http://127.0.0.1:9222/json', res => {
    let d=''; res.on('data', c=>d+=c); res.on('end', ()=>r(JSON.parse(d)));
  }));
  const t = targets.find(x => x.url.includes('pharmdog.clinpgx.org'));
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  ws.send(JSON.stringify({ id: 1, method: 'Page.navigate', params: { url: 'https://pharmdog.clinpgx.org/drugs/details/PA449088' } }));
  
  setTimeout(() => {
    ws.send(JSON.stringify({
      id: 2,
      method: 'Runtime.evaluate',
      params: { expression: 'document.title + " | " + document.body.innerText.slice(0, 1000).replace(/\\n+/g, " ")' }
    }));
  }, 2500);

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id === 2) {
      console.log('--- PHARMDOG DRUG DETAILS (CODEINE) ---');
      console.log(msg.result?.result?.value);
      ws.close();
    }
  };
})();
