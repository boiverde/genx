// GENX server-only GSI proxy. Fail closed until credentials are configured.
const { createHash, timingSafeEqual } = require('node:crypto');
const API = 'https://api.clinpgx.org/v1/site/gsi';
const GENE = /^[A-Za-z0-9_-]{2,24}$/;
function reply(res, status, data) { res.setHeader('Cache-Control','no-store'); return res.status(status).json(data); }
function safeEqual(a,b) { const x=Buffer.from(a||''); const y=Buffer.from(b||''); return x.length===y.length && timingSafeEqual(x,y); }
module.exports = async function handler(req,res) {
 if(req.method!=='POST') { res.setHeader('Allow','POST');return reply(res,405,{error:'method_not_allowed'}); }
 const url=process.env.SUPABASE_URL;
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const token=process.env.GENX_PROXY_TOKEN;
 if(!url||!secret||!token) return reply(res,503,{error:'proxy_not_configured'});
 if(!safeEqual((req.headers.authorization||'').replace(/^Bearer /i,''),token)) return reply(res,401,{error:'unauthorized'});
 const data=req.body||{};
 const raw=data.genotypes;
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length<1||Object.keys(raw).length>25) return reply(res,400,{error:'invalid_genotypes'});
 const sorted={};
 for(const gene of Object.keys(raw).sort()) {
  const v=raw[gene];
  if(!GENE.test(gene)||!Array.isArray(v)||v.length!==2||v.some(x=>typeof x!=='string'||x.length>32))return reply(res,400,{error:'invalid_genotypes'});
  sorted[gene]=v;
 }
 const sources=Array.isArray(data.sources)?data.sources:['cpic','dpwg','fda'];
 if(!sources.length||sources.length>3||sources.some(s=>!['cpic','dpwg','fda'].includes(s)))return reply(res,400,{error:'invalid_sources'});
 const payload=JSON.stringify({genotypes:sorted,sources:[...new Set(sources)].sort()});
 if(payload.length>12000)return reply(res,413,{error:'payload_too_large'});
 const id=createHash('sha256').update(payload).digest('hex');
 const base=url.replace(/\/$/,'')+'/rest/v1/gsi_cache';
 const headers={apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'};
 try {
  const cached=await fetch(base+'?id=eq.'+id+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString())+'&select=response_payload',{headers,signal:AbortSignal.timeout(4000)});
  if(!cached.ok)throw new Error('cache_read_failed');
  const hit=await cached.json();
  if(hit.length)return reply(res,200,{source:'cache',data:hit[0].response_payload});
  const upstream=await fetch(API+'?view=most&sources='+encodeURIComponent([...new Set(sources)].sort().join(',')),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sorted),signal:AbortSignal.timeout(9000)});
  if(!upstream.ok)return reply(res,502,{error:'upstream_unavailable',status:upstream.status});
  const result=await upstream.json();
  const persist=await fetch(base+'?on_conflict=id',{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id,genotype_payload:sorted,response_payload:result,expires_at:new Date(Date.now()+86400000).toISOString()})});
  if(!persist.ok)return reply(res,503,{error:'cache_write_failed'});
  return reply(res,200,{source:'upstream',data:result});
 } catch(e){return reply(res,503,{error:'proxy_temporarily_unavailable'});}
};