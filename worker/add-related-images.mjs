import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const SUPABASE_URL=process.env.SUPABASE_URL, KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!SUPABASE_URL||!KEY)throw new Error('Supabase env ausente');
const H={apikey:KEY,Authorization:`Bearer ${KEY}`};
const r=await fetch(`${SUPABASE_URL}/rest/v1/articles?status=eq.review&select=slug,image_url,cached_image_url`,{headers:H});
if(!r.ok)throw new Error(`articles ${r.status}`);const articles=await r.json();const images=new Map(articles.map(a=>[String(a.slug||'').toLowerCase(),a.cached_image_url||a.image_url||'']));
const esc=v=>String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
let changed=0;
async function walk(dir){let entries=[];try{entries=await readdir(dir,{withFileTypes:true})}catch{return}for(const e of entries){const p=join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.name==='index.html'){let html=await readFile(p,'utf8');const next=html.replace(/<a class="related-card" href="(?:https:\/\/sites84\.github\.io\/Tech-check)?\/noticias\/([^/]+)\/">(?!<img)/g,(m,slug)=>{const img=images.get(decodeURIComponent(slug).toLowerCase());return img?`${m}<img class="related-card-image" src="${esc(img)}" alt="" loading="lazy" decoding="async">`:m});if(next!==html){await writeFile(p,next);changed++}}}}
await walk('noticias');console.log(`Leia também: ${changed} páginas atualizadas com imagens.`);