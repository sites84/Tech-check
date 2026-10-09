import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
const URL=process.env.SUPABASE_URL,KEY=process.env.SUPABASE_SERVICE_ROLE_KEY,SITE='https://sites84.github.io/Tech-check';
const H={apikey:KEY,Authorization:`Bearer ${KEY}`};
const attr=(t,n)=>t.match(new RegExp(`\b${n}\\s*=\\s*["']([^"']+)["']`,'i'))?.[1]||'';
const abs=(v,b)=>{try{return new URL(String(v).trim(),b).href}catch{return''}};
const clean=v=>{try{const u=new URL(v);u.hash='';return u.href}catch{return''}};
const urlsFromSet=v=>String(v||'').split(',').map(x=>x.trim().split(/\\s+/)[0]).filter(Boolean);
function blockPart(html){return html.match(/<article\b[^>]*>[\s\S]*?<\/article>/i)?.[0]||html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0]||html}
function images(html,base){
 const a=blockPart(html),out=[];
 const add=v=>{const u=abs(v,base);if(u)out.push(clean(u))};
 for(const m of a.matchAll(/<img\b[^>]*>/gi)){
  const t=m[0];
  for(const x of [attr(t,'data-src'),attr(t,'data-lazy-src'),attr(t,'data-original'),attr(t,'data-url'),attr(t,'src'),...urlsFromSet(attr(t,'srcset')), ...urlsFromSet(attr(t,'data-srcset'))]){if(x){add(x);break}}
 }
 for(const m of a.matchAll(/<picture\b[\s\S]*?<\/picture>/gi)){
  const p=m[0];
  for(const s of p.matchAll(/<source\b[^>]*>/gi)) for(const x of [attr(s[0],'src'),...urlsFromSet(attr(s[0],'srcset')), ...urlsFromSet(attr(s[0],'data-srcset'))]) if(x) add(x);
 }
 for(const m of a.matchAll(/<source\b[^>]*>/gi)) for(const x of [attr(m[0],'src'),...urlsFromSet(attr(m[0],'srcset'))]) if(x) add(x);
 // Some publishers put gallery URLs on links around the image instead of on <img> itself.
 for(const m of a.matchAll(/<a\b[^>]*>[\s\S]*?<img\b[^>]*>[\s\S]*?<\/a>/gi)){const u=attr(m[0],'href');if(/\.(jpe?g|png|webp|gif)(\?|$)/i.test(u))add(u)}
 // Fallbacks outside the article for publishers whose gallery is declared in metadata.
 for(const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image|image|og:image:url)["'][^>]+>/gi)) add(attr(m[0],'content'));
 // JSON-LD image fields, including arrays and ImageObject/contentUrl.
 for(const m of html.matchAll(/<script[^>]+type=["']application\\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{const data=JSON.parse(m[1].trim());const walk=x=>{if(!x)return;if(typeof x==='string'){if(/^https?:/i.test(x)&&/\.(jpe?g|png|webp|gif)(\?|$)/i.test(x))add(x);return}if(Array.isArray(x)){x.forEach(walk);return}if(typeof x==='object')Object.entries(x).forEach(([k,v])=>{if(/image|contentUrl|thumbnailUrl|url/i.test(k))walk(v);else if(typeof v==='object')walk(v)})};walk(data)}catch{}
 }
 return [...new Set(out.filter(Boolean))];
}
function videos(html,base){const out=[];const add=v=>{const u=abs(v,base);if(u)out.push(u)};
 for(const m of html.matchAll(/<iframe\b[^>]*>/gi)){const u=attr(m[0],'src');if(u&&/(youtube|youtu\.be|vimeo|dailymotion|wistia|loom|twitch)/i.test(u))add(u)}
 for(const m of html.matchAll(/<video\b[^>]*>[\s\S]*?<\/video>/gi)){const v=m[0];for(const s of v.matchAll(/<source\b[^>]*>/gi))add(attr(s[0],'src'));add(attr(v,'src'))}
 for(const m of html.matchAll(/<a\b[^>]+href=["']([^"']+)["'][^>]*>/gi)){const u=m[1];if(/(youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com)/i.test(u))add(u)}
 return [...new Set(out)];
}
async function api(p){const r=await fetch(`${URL}/rest/v1/${p}`,{headers:H});if(!r.ok)throw Error(await r.text());return r.json()}
async function get(url){try{const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 Tech Check Media Collector'},redirect:'follow',signal:AbortSignal.timeout(20000)});return r.ok?await r.text():''}catch{return''}}
async function save(url,slug,n){try{const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 Tech Check Media Collector','Referer':url},redirect:'follow',signal:AbortSignal.timeout(20000)});if(!r.ok)return null;const type=r.headers.get('content-type')||'';if(!/^image\\//i.test(type))return null;const ext=type.includes('png')?'png':type.includes('gif')?'gif':type.includes('webp')?'webp':'jpg';const name=`original-${slug}-${n}.${ext}`;await mkdir('assets/news',{recursive:true});await writeFile(`assets/news/${name}`,Buffer.from(await r.arrayBuffer()));return`${SITE}/assets/news/${name}`}catch{return null}}
function mediaBlock(imgs,vids,title){if(!imgs.length&&!vids.length)return'';let h='<section class="original-media"><h2>Fotos e vídeos da fonte original</h2>';if(imgs.length)h+='<div class="original-media-grid">'+imgs.map((u,i)=>`<figure><img src="${u}" alt="${title} — foto ${i+1}" loading="lazy" decoding="async"><figcaption>Foto ${i+1}</figcaption></figure>`).join('')+'</div>';for(const [i,v] of vids.entries())h+=`<div class="original-video"><iframe src="${v}" title="${title} — vídeo ${i+1}" loading="lazy" allowfullscreen></iframe></div>`;return h+'</section>'}
function normalizeUrl(value=''){try{const u=new URL(value);u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|ref$|source$)/i.test(k))u.searchParams.delete(k);u.hostname=u.hostname.toLowerCase().replace(/^www\./,'');u.pathname=u.pathname.replace(/\/+$/,'')||'/';return u.toString()}catch{return String(value).trim().replace(/[?#].*$/,'').replace(/\/$/,'')}}
let rssMedia={};try{rssMedia=JSON.parse(await readFile('data/original-media.json','utf8')).items||{}}catch{}
const rows=await api('articles?status=eq.review&select=id,title,slug,original_url&limit=1000');let done=0,totalImages=0,totalVideos=0;
for(const a of rows){if(!a.slug||!a.original_url)continue;const p=`noticias/${a.slug}/index.html`;if(!existsSync(p))continue;const src=await get(a.original_url);const rss=rssMedia[normalizeUrl(a.original_url)]||{images:[],videos:[]};if(!src&&!rss.images?.length&&!rss.videos?.length)continue;const us=[...new Set([...(rss.images||[]),...(src?images(src,a.original_url):[])])],saved=[];for(let i=0;i<us.length;i++){const x=await save(us[i],a.slug,i+1);if(x)saved.push(x)}const vs=videos(src,a.original_url);totalImages+=saved.length;totalVideos+=vs.length;const html=await readFile(p,'utf8');const cleanHtml=html.replace(/<section class="original-media">[\s\S]*?<\/section>/i,'');const b=mediaBlock(saved,vs,a.title||'Matéria');if(!b)continue;await writeFile(p,cleanHtml.replace('<div class="article-body">',b+'<div class="article-body">'));done++}
console.log(`Mídia original: ${done} páginas, ${totalImages} imagens, ${totalVideos} vídeos.`);