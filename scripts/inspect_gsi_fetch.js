const fs = require('fs');
const path = require('path');

const bundlePath = path.resolve(__dirname, '..', 'evidencias', 'pharmdog_bundle.js');
const code = fs.readFileSync(bundlePath, 'utf8');

const postIdx = code.indexOf('method:"POST",headers:{"Content-Type":"application/json"}');
console.log('Context before POST:');
console.log(code.slice(Math.max(0, postIdx - 500), postIdx + 50));
