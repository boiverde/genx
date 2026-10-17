'use strict';
// P0 clinical-safety regression suite. Read-only mocks: no network or patient data.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'prototipo', 'prototype-clinpgx.html'), 'utf8');
const match = html.match(/<script id="domain-logic">([\s\S]*?)<\/script>/);
assert.ok(match, 'Expected clinical domain script');
const context = vm.createContext({});
vm.runInContext(match[1] + '\nglobalThis.clinicalTest = { runLocalFallbackEngine, CLINPGX_GENE_REGISTRY };', context, { timeout: 2000 });
const { runLocalFallbackEngine } = context.clinicalTest;
const handler = require('../api/gsi');

for (const gene of ['CYP2D6', 'CYP2C19', 'SLCO1B1', 'DPYD', 'TPMT']) {
  test('P0 unknown ' + gene + ' blocks offline prescriptions', () => {
    const result = runLocalFallbackEngine({ [gene]: ['*1', '*UNMAPPED'] }, []);
    assert.equal(result.clinicalReviewRequired, true);
    assert.equal(result.clinicalReviewCode, 'UNMAPPED_ALLELES');
    assert.equal(Object.keys(result.drugs).length, 0);
  });
}
test('P0 mixed profile with unmapped allele blocks every recommendation', () => {
  const result = runLocalFallbackEngine({ CYP2C19: ['*1', '*UNMAPPED'], DPYD: ['*1', '*2A'] }, []);
  assert.equal(result.clinicalReviewRequired, true);
  assert.deepEqual(Object.keys(result.drugs), []);
});
test('P0 CYP2D6 inhibitor blocks unvalidated offline advice', () => {
  const result = runLocalFallbackEngine({ CYP2D6: ['*1', '*1'] }, ['fluoxetine']);
  assert.equal(result.clinicalReviewRequired, true);
  assert.equal(Object.keys(result.drugs).length, 0);
});
test('Nonaffected CYP2D6 known alleles retain reference warnings', () => {
  const result = runLocalFallbackEngine({ CYP2D6: ['*4', '*4'] }, []);
  assert.equal(result.clinicalReviewRequired, false);
  assert.match(result.drugs.codeine.cpic.annotations[0].description, /EVITAR/i);
});
test('Nonaffected DPYD retains local reference annotations', () => {
  const result = runLocalFallbackEngine({ DPYD: ['*1', '*2A'] }, []);
  assert.equal(result.clinicalReviewRequired, false);
  assert.ok(result.drugs.fluorouracil);
});


// The server and browser must use exactly the same supported allele catalogue.
test('P0 frontend/backend allele registries remain synchronized across all 25 genes', () => {
  const serverRegistry = require('../api/gsi_alleles');
  const frontRegistry = JSON.parse(JSON.stringify(context.clinicalTest.CLINPGX_GENE_REGISTRY));
  assert.equal(Object.keys(serverRegistry).length, 25);
  assert.deepEqual(serverRegistry, frontRegistry);
});
test('P0 unknown HLA allele is indeterminate offline, not a negative result', () => {
  const result = runLocalFallbackEngine({ 'HLA-B': ['*UNMAPPED', 'Negative'] }, []);
  assert.equal(result.clinicalReviewRequired, true);
  assert.equal(Object.keys(result.drugs).length, 0);
});
test('P0 imported unsupported allele stays visible and selected in the UI', () => {
  const script = html.match(/function renderAlleleOptions\(gene, selectedAllele\) \{[\s\S]*?\n\}/);
  assert.ok(script, 'Missing allele option renderer');
  vm.runInContext(script[0] + '\nglobalThis.testAlleleOptions = renderAlleleOptions;', context);
  const unknown = context.testAlleleOptions('CYP2D6', '*UNMAPPED');
  assert.match(unknown, /value="\*UNMAPPED" selected disabled/);
  assert.match(unknown, /Alelo não reconhecido: \*UNMAPPED/);
  const normal = context.testAlleleOptions('CYP2D6', '*1');
  assert.match(normal, /value="\*1" selected/);
  assert.doesNotMatch(normal, /Alelo não reconhecido/);
  const injected = context.testAlleleOptions('CYP2D6', '<img onerror=alert(1)>');
  assert.doesNotMatch(injected, /<img/);
  assert.match(injected, /&lt;img/);
  assert.match(html, /renderAlleleOptions\(gene, alleles\[0\]\)/);
  assert.match(html, /renderAlleleOptions\(gene, alleles\[1\]\)/);
});

const officialFixture = {
  phenotypes: { CYP2D6: 'Normal Metabolizer (AS: 2.0)' },
  drugs: { codeine: { cpic: { annotations: [{ description: 'Dose padrão', notActionable: true }] } } }
};
async function callProxy({ mode = 'upstream', medications = ['fluoxetine'], origin = 'https://genx-sand.vercel.app', genotype = { CYP2D6: ['*1', '*1'] } } = {}) {
  const oldFetch = global.fetch;
  const keys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GENX_PROXY_TOKEN', 'VERCEL_ENV'];
  const original = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  const calls = [];
  process.env.SUPABASE_URL = 'https://mock.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-not-a-real-secret';
  process.env.GENX_PROXY_TOKEN = 'test-not-a-real-token';
  process.env.VERCEL_ENV = 'production';
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push(u);
    if (u.includes('rpc/reserve_gsi_rate_limit')) return { ok: true, json: async () => true };
    if (u.includes('/rest/v1/gsi_cache')) {
      if (opts.method === 'POST') return { ok: true };
      if (mode === 'cached') {
        return { ok: true, json: async () => [{
          response_payload: {
            phenotypes: { CYP2D6: 'Poor Metabolizer (AS: 0.0) [Fenoconvertido por inibidor]' },
            phenotypesOriginal: { CYP2D6: 'Normal Metabolizer (AS: 2.0)' },
            drugs: officialFixture.drugs
          }
        }] };
      }
      return { ok: true, json: async () => [] };
    }
    if (u.startsWith('https://api.clinpgx.org/')) return { ok: true, json: async () => officialFixture };
    throw Error('Unexpected mocked URL: ' + u);
  };
  const res = {
    statusCode: 0, body: null,
    setHeader() { return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  try {
    await handler({ method: 'POST', headers: { origin }, body: { genotypes: genotype, comedications: medications, sources: ['cpic'] } }, res);
    return { statusCode: res.statusCode, body: res.body, calls };
  } finally {
    global.fetch = oldFetch;
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
}
test('P0 uncached online inhibitor never releases drug guidance', async () => {
  const response = await callProxy();
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.clinicalReviewRequired, true);
  assert.equal(Object.keys(response.body.data.drugs).length, 0);
  assert.equal(response.body.data.phenotypes.CYP2D6, 'Normal Metabolizer (AS: 2.0)');
});
test('P0 old cached fenoconversion is blocked and genetic phenotype restored', async () => {
  const response = await callProxy({ mode: 'cached' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.source, 'cache');
  assert.equal(response.body.data.clinicalReviewRequired, true);
  assert.equal(Object.keys(response.body.data.drugs).length, 0);
  assert.equal(response.body.data.phenotypes.CYP2D6, 'Normal Metabolizer (AS: 2.0)');
});
test('P0 unknown CYP2D6 blocks online recommendations before upstream lookup', async () => {
  const response = await callProxy({
    genotype: { CYP2D6: ['*1', '*UNMAPPED'] },
    medications: []
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.source, 'validation');
  assert.equal(response.body.data.clinicalReviewRequired, true);
  assert.equal(response.body.data.clinicalReviewCode, 'UNMAPPED_ALLELES');
  assert.equal(Object.keys(response.body.data.drugs).length, 0);
  assert.equal(response.calls.some(c => c.includes('/rest/v1/gsi_cache')), false);
  assert.equal(response.calls.some(c => c.includes('api.clinpgx.org')), false);
});
test('P0 previously cached unknown CYP2C19 still gets blocked before cache read', async () => {
  const response = await callProxy({
    mode: 'cached',
    genotype: { CYP2C19: ['*1', '*UNMAPPED'] },
    medications: []
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.source, 'validation');
  assert.equal(response.body.data.clinicalReviewRequired, true);
  assert.equal(Object.keys(response.body.data.drugs).length, 0);
  assert.equal(response.calls.some(c => c.includes('/rest/v1/gsi_cache')), false);
});
test('P0 known patient alleles still access cached response', async () => {
  const response = await callProxy({
    mode: 'cached',
    medications: [],
    genotype: { CYP2D6: ['*1', '*1'] }
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.source, 'cache');
  assert.ok(response.body.data.drugs.codeine);
  assert.equal(response.calls.some(c => c.includes('/rest/v1/gsi_cache')), true);
});
test('No CYP2D6 inhibitor returns unchanged drug guidance', async () => {
  const response = await callProxy({ medications: [] });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.clinicalReviewRequired, undefined);
  assert.ok(response.body.data.drugs.codeine);
});
test('Unknown Origin is rejected before any network requests', async () => {
  const response = await callProxy({ origin: 'https://malicious.example' });
  assert.equal(response.statusCode, 401);
  assert.equal(response.calls.length, 0);
});
test('Empty genotype payload is rejected', async () => {
  const response = await callProxy({ genotype: {} });
  assert.equal(response.statusCode, 400);
});
test('Browser never contains private proxy token and blocks unsafe FHIR export', () => {
  assert.equal(html.includes('GENX_PROXY_TOKEN'), false);
  assert.match(html, /if \(currentGsiData\?\.clinicalReviewRequired\)/);
  assert.match(html, /if \(currentGsiData\.clinicalReviewRequired === true\)/);
});
