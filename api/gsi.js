// GENX serverless GSI gateway; sensitive Supabase credentials are server-only.
// Note: Origin/Referer is not authentication. All browser traffic is public and rate-limited.
const { createHash, timingSafeEqual } = require('node:crypto');
const ALLOWED_SOURCES = new Set(['cpic','dpwg','fda']);
const GENE = new Set(["CYP2D6","CYP2C19","CYP2C9","CYP2B6","CYP3A4","CYP3A5","SLCO1B1","DPYD","TPMT","NUDT15","UGT1A1","ABCG2","HLA-A","HLA-B","VKORC1","CYP4F2","G6PD","NAT2","RYR1","CACNA1S","rs12777823","F2","F5","MT-RNR1","CFTR"]);
function gsiData(result) {
  return result && typeof result === 'object' && !Array.isArray(result) &&
    result.data && typeof result.data === 'object' && !result.drugs
    ? result.data : result;
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
  const sources=[...new Set(s)].sort();
  const canonical=JSON.stringify({genotypes:normalized,sources});
  if(canonical.length>12000)return send(res,413,{error:'payload_too_large'});
  const id=createHash('sha256').update(canonical).digest('hex');
  const endpoint=base+'/rest/v1/gsi_cache';
  const headers={apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'};
  try {
    if(!await quota(base,headers,'client',fingerprint(req,token))){
      res.setHeader('Retry-After','60');
      return send(res,429,{error:'client_rate_limit'});
    }
    const cached=await fetch(endpoint+'?id=eq.'+id+'&expires_at=gt.'+
      encodeURIComponent(new Date().toISOString())+'&select=response_payload',{
      headers,signal:AbortSignal.timeout(4000)
    });
    if(!cached.ok)throw new Error('cache_read_failure');
    const rows=await cached.json();
    if(Array.isArray(rows)&&rows.length)return send(res,200,{source:'cache',data:gsiData(rows[0].response_payload)});
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
      body:JSON.stringify({id,genotype_payload:normalized,response_payload:result,
        expires_at:new Date(Date.now()+86400000).toISOString()}),
      signal:AbortSignal.timeout(4000)
    });
    if(!saved.ok)throw new Error('cache_write_failure');
    return send(res,200,{source:'upstream',data:result});
  } catch {return send(res,503,{error:'proxy_temporarily_unavailable'});}
};
