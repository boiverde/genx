/**
 * Comprehensive Feature Audit & Reverse Engineering of PharmDOG
 * Alvo: clinpgx/evidencias/pharmdog_bundle.js
 */

const fs = require('fs');
const path = require('path');

const bundlePath = path.resolve(__dirname, '..', 'evidencias', 'pharmdog_bundle.js');
const code = fs.readFileSync(bundlePath, 'utf8');

console.log('=== AUDITORIA PROFUNDA DE FUNCIONALIDADES DO PHARMDOG ===');
console.log(`Tamanho do Bundle: ${(code.length / 1024).toFixed(1)} KB`);

// 1. Identificar chaves de localStorage e variáveis de estado de sessão
const lsRegex = /localStorage\.(getItem|setItem|removeItem)\(([^)]+)\)/g;
const lsCalls = [];
let m;
while ((m = lsRegex.exec(code)) !== null) {
  lsCalls.push({ op: m[1], arg: m[2] });
}
console.log('\n--- 1. Persistência em LocalStorage ---');
lsCalls.forEach(c => console.log(`  ${c.op}: ${c.arg}`));

// 2. Identificar constantes de chaves
const keyVars = [...code.matchAll(/const\s+([a-zA-Z0-9_$]+)\s*=\s*["']([^"']+)["']/g)]
  .filter(match => match[2].startsWith('pharmdog') || match[2].includes('clinpgx') || match[2].includes('settings') || match[2].includes('genotypes') || match[2].includes('drugs'));
console.log('\n--- 2. Constantes de Armazenamento e Configuração ---');
keyVars.forEach(kv => console.log(`  ${kv[1]} = "${kv[2]}"`));

// 3. Mapear todas as rotas e seus respectivos componentes / fluxos
console.log('\n--- 3. Mapeamento de Rotas do React Router ---');
const routeRegex = /path:\s*["']([^"']*)["']/g;
const routes = [];
while ((m = routeRegex.exec(code)) !== null) {
  routes.push(m[1]);
}
console.log('Rotas identificadas:', [...new Set(routes)]);

// 4. Mapear todas as chamadas de API externas
console.log('\n--- 4. Endpoints e Chamadas de Rede ---');
const apiRegex = /["'](https:\/\/api\.clinpgx\.org\/v1[^"']*)["']/g;
const apiEndpoints = [];
while ((m = apiRegex.exec(code)) !== null) {
  apiEndpoints.push(m[1]);
}
console.log('Endpoints da API:', [...new Set(apiEndpoints)]);

// 5. Analisar como funciona a tela /genotypes
console.log('\n--- 5. Análise de Funcionalidade: /genotypes ---');
const genoIndex = code.indexOf('/genotypes');
if (genoIndex !== -1) {
  // Ver trecho do componente
  console.log('Contexto da rota /genotypes encontrado.');
}

// 6. Analisar como funciona a tela /drugs e /drugs/details
console.log('\n--- 6. Análise de Funcionalidade: /drugs ---');
const drugsIndex = code.indexOf('drugs/details');
console.log('Contexto de drugs/details encontrado no índice:', drugsIndex);

// 7. Analisar como funciona a tela /results (cálculo de compatibilidade multigene e multidrogas)
console.log('\n--- 7. Análise de Funcionalidade: /results ---');
const resultsIndex = code.indexOf('results');
console.log('Contexto de results encontrado.');

// 8. Verificar se existe importação/exportação de perfil genético (VCF, JSON, etc)
console.log('\n--- 8. Verificação de Recursos Avançados (VCF, Export, Impressão, Filtros) ---');
console.log('Menção a VCF:', code.includes('vcf') || code.includes('VCF'));
console.log('Menção a PharmCAT:', code.includes('pharmcat') || code.includes('PharmCAT'));
console.log('Menção a export/download:', code.includes('download') || code.includes('export'));
console.log('Menção a print/impressão:', code.includes('window.print') || code.includes('print'));
console.log('Menção a DPWG:', code.includes('dpwg') || code.includes('DPWG'));
console.log('Menção a FDA:', code.includes('fda') || code.includes('FDA'));
console.log('Menção a CPIC:', code.includes('cpic') || code.includes('CPIC'));
console.log('Menção a pediatric/pediatria:', code.includes('pediatric') || code.includes('isPediatric'));
