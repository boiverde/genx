const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT_DIR, 'MANIFEST_SHA256.txt');

function getFiles(dir, fileList = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item === 'node_modules' || item === '.git' || item === 'MANIFEST_SHA256.txt') continue;
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getFiles(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const allFiles = getFiles(ROOT_DIR);
const lines = [
  '# ClinPGx REA Laboratory — Manifesto Criptográfico de Integridade (SHA-256)',
  `# Data de Geração: ${new Date().toISOString()}`,
  '# Escopo: 100% Hermético em C:\\Users\\merca\\REA-Laboratorio\\clinpgx\\',
  ''
];

allFiles.sort().forEach(filePath => {
  const content = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
  lines.push(`${hash}  ${relPath}`);
});

fs.writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf8');
console.log(`Manifesto gerado com sucesso: ${OUTPUT_FILE}`);
console.log(`Total de arquivos auditados: ${allFiles.length}`);
