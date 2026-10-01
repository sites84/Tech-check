const SUPABASE_URL=process.env.SUPABASE_URL;
const KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!SUPABASE_URL||!KEY)throw new Error('Supabase secrets ausentes');
const headers={apikey:KEY,Authorization:`Bearer ${KEY}`};
const esc=v=>String(v||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
function findImage(html){
  const patterns=[
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i
  ];
  for(const p of patterns){const m=html.match(p);if(m?.[1])return esc(m[1]);}
  const json=html.match(/"image"\s*:\s*(?:\[\s*)?["']([^"']+)["']/i);return json?.[1]?esc(json[1]):null;
}
async function main(){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/affiliate_products?active=eq.true&select=id,affiliate_url,image_url`,{headers});
  if(!r.ok)throw new Error(`list ${r.status}`);const products=await r.json();
  for(const p of products){
    if(!p.affiliate_url||p.image_url)continue;
    try{
      const page=await fetch(p.affiliate_url,{redirect:'follow',headers:{'user-agent':'Mozilla/5.0 (compatible; TechCheckBot/1.0)'}});
      if(!page.ok)continue;
      const html=await page.text();const image=findImage(html);if(!image)continue;
      const u=`${SUPABASE_URL}/rest/v1/affiliate_products?id=eq.${encodeURIComponent(p.id)}`;
      const save=await fetch(u,{method:'PATCH',headers:{...headers,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({image_url:image})});
      if(save.ok)console.log(`imagem salva: ${p.id}`);else console.warn(`falha ao salvar ${p.id}: ${save.status}`);
    }catch(e){console.warn(`imagem ${p.id}: ${e.message}`);}
  }
}
main().catch(e=>{console.error(e);process.exit(1);});
