const fs = require('fs');
const path = require('path');

const bundlePath = path.resolve(__dirname, '..', 'evidencias', 'pharmdog_bundle.js');
const code = fs.readFileSync(bundlePath, 'utf8');

// Find the component that renders the results
const resIdx = code.indexOf('ResultsSummary');
const resIdx2 = resIdx !== -1 ? resIdx : code.indexOf('results-container');
console.log('Results context:');
const targetIdx = resIdx !== -1 ? resIdx : code.indexOf('Actionable');
console.log(code.slice(Math.max(0, targetIdx - 200), Math.min(code.length, targetIdx + 400)));
