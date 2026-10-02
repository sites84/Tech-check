const base=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!base||!key)throw new Error('Supabase secrets ausentes.');
const headers={apikey:key,Authorization:`Bearer ${key}`, 'Content-Type':'application/json'};
async function getCategory(name){const r=await fetch(`${base}/rest/v1/categories?name=eq.${encodeURIComponent(name)}&select=id&limit=1`,{headers});if(!r.ok)throw Error(`category ${name} ${r.status}`);return (await r.json())[0]?.id;}
async function merge(from,to){const fromId=await getCategory(from),toId=await getCategory(to);if(!fromId||!toId)return;const r=await fetch(`${base}/rest/v1/article_categories?category_id=eq.${fromId}&select=article_id`,{headers});if(!r.ok)return;for(const row of await r.json()){const exists=await fetch(`${base}/rest/v1/article_categories?article_id=eq.${row.article_id}&category_id=eq.${toId}&select=article_id`,{headers});if((await exists.json()).length===0)await fetch(`${base}/rest/v1/article_categories`,{method:'POST',headers,body:JSON.stringify({article_id:row.article_id,category_id:toId})});await fetch(`${base}/rest/v1/article_categories?article_id=eq.${row.article_id}&category_id=eq.${fromId}`,{method:'DELETE',headers});}}
await merge('Espaço','Ciência');
await merge('Gadgets','Smartphones');
console.log('Categorias consolidadas: Espaço → Ciência; Gadgets → Smartphones.');