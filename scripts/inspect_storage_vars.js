const fs = require('fs');
const path = require('path');

const bundlePath = path.resolve(__dirname, '..', 'evidencias', 'pharmdog_bundle.js');
const code = fs.readFileSync(bundlePath, 'utf8');

const targetVars = ['Ns', 'Ol', 'Rh', 'jh', 'Gv', 'Dh', 'v0'];
targetVars.forEach(v => {
  const idx = code.indexOf(v + '="');
  const idx2 = code.indexOf(v + "='");
  const i = idx !== -1 ? idx : idx2;
  if (i !== -1) {
    console.log(code.slice(i, i + 40));
  } else {
    // Check comma separated declarations
    const m = code.match(new RegExp(`[,{;]\\s*${v}\\s*=\\s*["']([^"']+)["']`));
    console.log(v, '=>', m ? m[1] : 'not found');
  }
});
