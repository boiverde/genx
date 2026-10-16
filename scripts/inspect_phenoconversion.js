const fs = require('fs');
const path = require('path');

const bundlePath = path.resolve(__dirname, '..', 'evidencias', 'pharmdog_bundle.js');
const code = fs.readFileSync(bundlePath, 'utf8');

const matches = [...code.matchAll(/phenoconversion[a-zA-Z0-9_]*/gi)].map(m => m[0]);
console.log('Phenoconversion occurrences in PharmDOG bundle:');
console.log([...new Set(matches)]);

const pIdx = code.indexOf('phenoconversion');
console.log('\nSample context:');
console.log(code.slice(Math.max(0, pIdx - 150), Math.min(code.length, pIdx + 350)));
