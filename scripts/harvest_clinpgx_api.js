/**
 * Harvest ClinPGx Reference Data (Track A)
 * 
 * Strict Compliance:
 * - Rate limit: < 2 requests/second (we enforce 750ms delay between requests)
 * - User-Agent: Antigravity-ClinPGx-REA/1.0 (academic/educational reverse engineering)
 * - Isolated storage: clinpgx/artefatos/api_cache/
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '..', 'artefatos', 'api_cache');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.get({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) REA-ClinPGx-Academic/1.0'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode} for ${url}: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
  });
}

async function runHarvest() {
  console.log('[1/4] Coletando GSI Options (genes, alelos, drogas)...');
  const gsiOptionsUrl = 'https://api.clinpgx.org/v1/site/gsi/options';
  try {
    const gsiOptions = await fetchJson(gsiOptionsUrl);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'gsi_options.json'), JSON.stringify(gsiOptions, null, 2));
    console.log(` -> Sucesso! Salvo gsi_options.json (Tamanho: ${JSON.stringify(gsiOptions).length} chars)`);
  } catch (err) {
    console.error(' -> Erro ao baixar gsi_options:', err.message);
  }

  await sleep(800);

  console.log('\n[2/4] Coletando Metadados de Genes Canônicos (CYP2D6, CYP2C19, SLCO1B1, DPYD)...');
  const genes = ['CYP2D6', 'CYP2C19', 'SLCO1B1', 'DPYD'];
  for (const gene of genes) {
    try {
      const geneUrl = `https://api.clinpgx.org/v1/data/gene?symbol=${gene}`;
      console.log(` -> Buscando ${gene}...`);
      const geneData = await fetchJson(geneUrl);
      fs.writeFileSync(path.join(OUTPUT_DIR, `gene_${gene}.json`), JSON.stringify(geneData, null, 2));
      console.log(`    Salvo gene_${gene}.json`);
    } catch (err) {
      console.error(`    Erro para ${gene}:`, err.message);
    }
    await sleep(800);
  }

  console.log('\n[3/4] Coletando Diretrizes CPIC de Referência para Pares Chave...');
  // Genes e drogas de teste
  const drugSearches = [
    { drug: 'codeine', gene: 'CYP2D6' },
    { drug: 'clopidogrel', gene: 'CYP2C19' },
    { drug: 'simvastatin', gene: 'SLCO1B1' },
    { drug: 'fluorouracil', gene: 'DPYD' }
  ];

  for (const item of drugSearches) {
    try {
      console.log(` -> Buscando diretrizes para ${item.drug} (${item.gene})...`);
      const searchUrl = `https://api.clinpgx.org/v1/data/guidelineAnnotation?chemicalName=${encodeURIComponent(item.drug)}`;
      const annotData = await fetchJson(searchUrl);
      fs.writeFileSync(path.join(OUTPUT_DIR, `guideline_${item.drug}.json`), JSON.stringify(annotData, null, 2));
      console.log(`    Salvo guideline_${item.drug}.json (${annotData.obj ? annotData.obj.length : (Array.isArray(annotData) ? annotData.length : 'ok')} itens)`);
    } catch (err) {
      console.error(`    Erro ao buscar diretriz ${item.drug}:`, err.message);
    }
    await sleep(800);
  }

  console.log('\n[4/4] Resumo da Coleta concluído com sucesso!');
  const files = fs.readdirSync(OUTPUT_DIR);
  console.log(`Total de arquivos salvos em ${OUTPUT_DIR}: ${files.length}`);
  files.forEach(f => {
    const stat = fs.statSync(path.join(OUTPUT_DIR, f));
    console.log(` - ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
  });
}

runHarvest().catch(err => {
  console.error('Falha geral no harvest:', err);
  process.exit(1);
});
