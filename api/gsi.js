// GENX serverless GSI gateway; sensitive Supabase credentials are server-only.
// Note: Origin/Referer is not authentication. All browser traffic is public and rate-limited.
const { createHash, timingSafeEqual } = require('node:crypto');
const SUPPORTED_ALLELES = require('./gsi_alleles');
const ALLOWED_SOURCES = new Set(['cpic','dpwg','fda']);
const GENE = new Set(Object.keys(SUPPORTED_ALLELES));
function gsiData(result) {
  return result && typeof result === 'object' && !Array.isArray(result) &&
    result.data && typeof result.data === 'object' && !result.drugs
    ? result.data : result;
}

// Clinical safety gate: the ClinPGx upstream request does not include comedications.
// Therefore a CYP2D6 inhibitor must never be applied only to the phenotype while
// leaving unreconciled drug/dose recommendations visible to browsers or partners.
// Apply this gate to both upstream AND older cached payloads.
function clinicallySafeResult(result, genotypes, comedications) {
  const inhibitors = comedications.filter(c =>
    ['fluoxetine','paroxetine','bupropion'].includes(c.trim().toLowerCase()));
  if (!genotypes.CYP2D6 || inhibitors.length === 0) return result;
  const payload = result && typeof result === 'object' && !Array.isArray(result) ? result : {};
  const original = payload.phenotypesOriginal &&
    typeof payload.phenotypesOriginal === 'object' ? payload.phenotypesOriginal : payload.phenotypes;
  const geneticPhenotypes = original && typeof original === 'object' ? { ...original } : {};
  if (typeof geneticPhenotypes.CYP2D6 === 'string' &&
      /fenoconvertido/i.test(geneticPhenotypes.CYP2D6)) {
    // The original phenotype is not recoverable from this historical cache row.
    geneticPhenotypes.CYP2D6 = 'Fenótipo genético original não confirmado';
  }
  return {
    phenotypes: geneticPhenotypes,
    phenotypesOriginal: geneticPhenotypes,
    phenoconversionDrugs: inhibitors,
    drugs: {},
    clinicalReviewRequired: true,
    clinicalReviewCode: 'CYP2D6_PHENOCONVERSION_UNRESOLVED',
    clinicalReviewMessage: 'Inibidor forte de CYP2D6 selecionado. A API consultada não recebeu as comedicações e as recomendações farmacológicas não foram recalculadas por um motor validado. Não utilizar este resultado para escolher medicamentos ou doses.'
  };
}

function send(res,status,value) {
  res.setHeader('Cache-Control','no-store');
  return res.status(status).json(value);
}
function timingSafeToken(a,b) {
  const x=Buffer.from(a||''),y=Buffer.from(b||'');
  return x.length===y.length && timingSafeEqual(x,y);
}
function allowedSite(value,originHeader) {
  if(typeof value!=='string'||value.length>2048)return false;
  try {
    const u=new URL(value);
    if(u.username||u.password||u.hash)return false;
    if(originHeader&&(u.pathname!=='/'||u.search))return false;
    if(u.protocol==='https:'&&u.host==='genx-sand.vercel.app')return true;
    return process.env.VERCEL_ENV!=='production' &&
      (u.hostname==='localhost'||u.hostname==='127.0.0.1') &&
      (u.protocol==='http:'||u.protocol==='https:');
  } catch {return false;}
}
function allowedBrowser(req) {
  if(req.headers.origin!==undefined)return allowedSite(req.headers.origin,true);
  return allowedSite(req.headers.referer,false);
}
function fingerprint(req,salt) {
  const x=req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for'];
  const ip=typeof x==='string'?x.split(',')[0].trim():'unknown';
  return createHash('sha256').update(salt).update(':').update(ip||'unknown').digest('hex');
}
async function quota(base,headers,bucket,hash) {
  const r=await fetch(base+'/rest/v1/rpc/reserve_gsi_rate_limit',{
    method:'POST',headers,
    body:JSON.stringify({p_bucket_type:bucket,p_client_hash:bucket==='client'?hash:null}),
    signal:AbortSignal.timeout(4000)
  });
  if(!r.ok)throw new Error('quota_api_failure');
  return (await r.json())===true;
}
module.exports=async function handler(req,res) {
  if(req.method!=='POST'){res.setHeader('Allow','POST');return send(res,405,{error:'method_not_allowed'});}
  const base=process.env.SUPABASE_URL?.replace(/\/$/,'');
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token=process.env.GENX_PROXY_TOKEN;
  if(!base||!secret||!token)return send(res,503,{error:'proxy_not_configured'});
  const bearer=(req.headers.authorization||'').match(/^Bearer (.+)$/i);
  if(!(bearer&&timingSafeToken(bearer[1],token))&&!allowedBrowser(req)){
    return send(res,401,{error:'unauthorized'});
  }
  const input=req.body;
  if(!input||typeof input!=='object'||Array.isArray(input))return send(res,400,{error:'invalid_payload'});
  const genes=input.genotypes;
  if(!genes||typeof genes!=='object'||Array.isArray(genes))return send(res,400,{error:'invalid_genotypes'});
  const names=Object.keys(genes).sort();
  if(!names.length||names.length>25)return send(res,400,{error:'invalid_genotypes'});
  const normalized=Object.create(null);
  for(const gene of names) {
    const a=genes[gene];
    if(!GENE.has(gene)||!Array.isArray(a)||a.length!==2||
      a.some(v=>typeof v!=='string'||!v.length||v.length>80)){
      return send(res,400,{error:'invalid_genotypes'});
    }
    normalized[gene]=a;
  }
  const s=input.sources===undefined?['cpic','dpwg','fda']:input.sources;
  if(!Array.isArray(s)||!s.length||s.length>3||
     s.some(v=>typeof v!=='string'||!ALLOWED_SOURCES.has(v))){
    return send(res,400,{error:'invalid_sources'});
  }
  // A schema-valid string is not necessarily a clinically recognized allele.
  // Block the entire assessment if any genotype is outside the GENX UI registry.
  const unmappedGenes = names.filter(gene => {
    const supported = SUPPORTED_ALLELES[gene];
    return !Array.isArray(supported) || normalized[gene].some(allele => !supported.includes(allele));
  });
  const sources=[...new Set(s)].sort();
  const comedications=Array.isArray(input.comedications)
    ? [...new Set(input.comedications.filter(c=>typeof c==='string'&&c.length<=40))].sort()
    : [];
  const canonical=JSON.stringify({genotypes:normalized,comedications,sources});
  if(canonical.length>12000)return send(res,413,{error:'payload_too_large'});
  const id=createHash('sha256').update(canonical).digest('hex');
  const endpoint=base+'/rest/v1/gsi_cache';
  const headers={apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'};
  try {
    if(!await quota(base,headers,'client',fingerprint(req,token))){
      res.setHeader('Retry-After','60');
      return send(res,429,{error:'client_rate_limit'});
    }
    // Fail closed *before* cache or ClinPGx lookups, including historical
    // cache entries created before this check existed. Return a safe envelope
    // so browsers can display a clear reason and block FHIR export.
    if(unmappedGenes.length){
      const phenotypes=Object.fromEntries(unmappedGenes.map(gene =>
        [gene,'Indeterminado / Variante Não Mapeada']));
      return send(res,200,{source:'validation',data:{
        phenotypes,
        phenotypesOriginal:{...phenotypes},
        drugs:{},
        clinicalReviewRequired:true,
        clinicalReviewCode:'UNMAPPED_ALLELES',
        clinicalReviewMessage:'Alelo(s) fora do catálogo GENX em: '+unmappedGenes.join(', ')+
          '. Não há interpretação clínica validada para esta avaliação. Nenhuma recomendação de medicamento ou dose será emitida.'
      }});
    }
    const cached=await fetch(endpoint+'?id=eq.'+id+'&expires_at=gt.'+
      encodeURIComponent(new Date().toISOString())+'&select=response_payload',{
      headers,signal:AbortSignal.timeout(4000)
    });
    if(!cached.ok)throw new Error('cache_read_failure');
    const rows=await cached.json();
    if(Array.isArray(rows)&&rows.length)return send(res,200,{source:'cache',data:clinicallySafeResult(gsiData(rows[0].response_payload),normalized,comedications)});
    if(!await quota(base,headers,'upstream',null)){
      res.setHeader('Retry-After','1');
      return send(res,429,{error:'upstream_rate_limit'});
    }
    const upstream=await fetch('https://api.clinpgx.org/v1/site/gsi?view=most&sources='+
      encodeURIComponent(sources.join(',')),{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(normalized),signal:AbortSignal.timeout(9000)
    });
    if(!upstream.ok)return send(res,502,{error:'upstream_unavailable',status:upstream.status});
    const result=gsiData(await upstream.json());
    const saved=await fetch(endpoint+'?on_conflict=id',{
      method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify({id,genotype_payload:{genotypes:normalized,comedications},response_payload:result,
        expires_at:new Date(Date.now()+86400000).toISOString()}),
      signal:AbortSignal.timeout(4000)
    });
    if(!saved.ok)throw new Error('cache_write_failure');
    return send(res,200,{source:'upstream',data:clinicallySafeResult(result,normalized,comedications)});
  } catch {return send(res,503,{error:'proxy_temporarily_unavailable'});}
};
