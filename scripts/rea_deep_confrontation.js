/**
 * REA Deep Confrontation Script
 * Navigates PharmDOG via CDP through all core routes and inspects DOM, components, and behavior.
 */

const http = require('http');

async function cdpRequest(targetId, method, params = {}) {
  const targets = await new Promise(r => http.get('http://127.0.0.1:9222/json', res => {
    let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d)));
  }));
  const target = targets.find(t => t.id === targetId || t.url.includes('pharmdog'));
  if (!target) throw new Error('Target PharmDOG not found');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  return new Promise((resolve, reject) => {
    let id = 1;
    const msgId = id++;
    const onMsg = (event) => {
      const data = JSON.parse(event.data);
      if (data.id === msgId) {
        ws.removeEventListener('message', onMsg);
        ws.close();
        if (data.error) reject(new Error(data.error.message));
        else resolve(data.result);
      }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}

async function runAudit() {
  console.log('--- REA CONFRONTATION: AUDITANDO TELAS DO PHARMDOG ORIGINAL ---');

  // Find target ID for PharmDOG
  const targets = await new Promise(r => http.get('http://127.0.0.1:9222/json', res => {
    let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d)));
  }));
  const pdTarget = targets.find(t => t.url.includes('pharmdog.clinpgx.org'));
  if (!pdTarget) {
    console.error('PharmDOG não encontrado nos targets CDP');
    return;
  }
  const tid = pdTarget.id;
  console.log('Alvo PharmDOG encontrado:', tid, pdTarget.url);

  // 1. Evaluate Current DOM on /
  const evalHome = await cdpRequest(tid, 'Runtime.evaluate', {
    expression: 'document.title + " | " + location.href + " | Botões: " + Array.from(document.querySelectorAll("button, a")).map(b => b.innerText.trim()).filter(Boolean).slice(0, 15).join(" ; ")'
  });
  console.log('\n[Home /]:', evalHome.result.value);

  // 2. Navigate to /genotypes
  await cdpRequest(tid, 'Runtime.evaluate', { expression: 'window.location.hash = ""; window.history.pushState({}, "", "/genotypes"); window.dispatchEvent(new PopStateEvent("popstate"));' });
  await new Promise(r => setTimeout(r, 1200));

  const evalGeno = await cdpRequest(tid, 'Runtime.evaluate', {
    expression: 'location.href + " | Inputs: " + document.querySelectorAll("input, select").length + " | Text: " + document.body.innerText.slice(0, 300).replace(/\\n+/g, " ")'
  });
  console.log('\n[/genotypes]:', evalGeno.result.value);

  // 3. Navigate to /drugs
  await cdpRequest(tid, 'Runtime.evaluate', { expression: 'window.history.pushState({}, "", "/drugs"); window.dispatchEvent(new PopStateEvent("popstate"));' });
  await new Promise(r => setTimeout(r, 1200));

  const evalDrugs = await cdpRequest(tid, 'Runtime.evaluate', {
    expression: 'location.href + " | Drugs lista: " + document.querySelectorAll(".drug-item, [class*=\"drug\"], [class*=\"chemical\"], li").length + " | Amostra: " + document.body.innerText.slice(0, 300).replace(/\\n+/g, " ")'
  });
  console.log('\n[/drugs]:', evalDrugs.result.value);

  // 4. Navigate to /settings
  await cdpRequest(tid, 'Runtime.evaluate', { expression: 'window.history.pushState({}, "", "/settings"); window.dispatchEvent(new PopStateEvent("popstate"));' });
  await new Promise(r => setTimeout(r, 1200));

  const evalSettings = await cdpRequest(tid, 'Runtime.evaluate', {
    expression: 'location.href + " | Settings Text: " + document.body.innerText.slice(0, 300).replace(/\\n+/g, " ")'
  });
  console.log('\n[/settings]:', evalSettings.result.value);
}

runAudit().catch(err => console.error('Erro na auditoria REA:', err));
