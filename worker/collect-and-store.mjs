import { writeFile } from 'node:fs/promises';
import { getSources, findArticleByUrl, findArticleByTitle, getRecentArticleTitles, insertArticle, updateArticleImage, attachSource } from './supabase.mjs';

function clean(value = '') {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}
function tag(xml, name) { const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i')); return match ? clean(match[1]) : ''; }
function attrTag(xml, name, attribute) { const match = xml.match(new RegExp(`<${name}[^>]*\\b${attribute}=["']([^"']+)["'][^>]*>`, 'i')); return match ? match[1].trim() : ''; }
function items(xml) { return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(m => m[1]); }
function normalizeUrl(value='') { try { const u = new URL(value.trim()); u.hash=''; for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|ref$|source$)/i.test(key)) u.searchParams.delete(key); u.hostname=u.hostname.toLowerCase().replace(/^www\./,''); u.pathname=u.pathname.replace(/\/+$/,'')||'/'; return u.toString(); } catch { return value.trim().replace(/[?#].*$/,'').replace(/\/$/,''); } }
function normalizeTitle(value='') { return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim(); }
function titleTokens(value='') { return new Set(normalizeTitle(value).split(' ').filter(w=>w.length>2)); }
function titleSimilarity(a,b) { const A=titleTokens(a),B=titleTokens(b); if(!A.size||!B.size)return 0; let intersection=0; for(const token of A)if(B.has(token))intersection++; const jaccard=intersection/(A.size+B.size-intersection); const containment=intersection/Math.min(A.size,B.size); return Math.max(jaccard,containment*0.9); }
function isNearDuplicate(title, existingTitle) { if(normalizeTitle(title)===normalizeTitle(existingTitle))return true; if(title.length<25||existingTitle.length<25)return false; return titleSimilarity(title,existingTitle)>=0.82; }
function firstImageFromRss(item) { const mediaContent=attrTag(item,'media:content','url'); if(mediaContent)return mediaContent; const mediaThumbnail=attrTag(item,'media:thumbnail','url'); if(mediaThumbnail)return mediaThumbnail; const enclosureMatch=item.match(/<enclosure[^>]*\burl=["']([^"']+)["'][^>]*\btype=["']image\/(?:jpeg|jpg|png|webp|gif)["'][^>]*>/i); if(enclosureMatch)return enclosureMatch[1].trim(); const html=item.match(/<(?:content:encoded|description)[^>]*>([\s\S]*?)<\/(?:content:encoded|description)>/i)?.[1]||''; const img=html.match(/<img[^>]*\bsrc=["']([^"']+)["']/i); return img?img[1].trim():''; }
async function imageFromArticlePage(url) { try { const response=await fetch(url,{headers:{'User-Agent':'Tech-Check/1.0 image metadata collector'},signal:AbortSignal.timeout(8000)}); if(!response.ok)return''; const html=await response.text(); const patterns=[/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i]; for(const pattern of patterns){const match=html.match(pattern);if(match?.[1])return new URL(match[1],url).href;}}catch{} return ''; }

function publicationDate(item){for(const name of ['pubDate','dc:date','published','date']){const v=tag(item,name);if(!v)continue;const d=new Date(v);if(!Number.isNaN(d.getTime()))return d.toISOString();}return null;}
function linkValue(item){return tag(item,'link')||attrTag(item,'link','href')||'';}
const FEED_FALLBACKS={'Animation Magazine':['https://news.google.com/rss/search?q=site%3Aanimationmagazine.net&hl=en-US&gl=US&ceid=US:en'],'Gizmodo':['https://news.google.com/rss/search?q=site%3Agizmodo.com%2Ftech&hl=en-US&gl=US&ceid=US:en']};
async function fetchFeed(source){const urls=[source.feed_url,...(FEED_FALLBACKS[source.name]||[])];let last=null;for(const feedUrl of urls){try{const r=await fetch(feedUrl,{headers:{'User-Agent':'Mozilla/5.0 (compatible; Tech-Check RSS collector)','Accept':'application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8'},signal:AbortSignal.timeout(15000)});if(!r.ok){last=Error(String(r.status));continue;}const xml=await r.text();if(!/<(?:item|entry)\b/i.test(xml)){last=Error('feed sem itens');continue;}return xml;}catch(e){last=e;}}throw last||Error('feed indisponível');}
const sources=await getSources();
const existingArticles=await getRecentArticleTitles(1000);
const collected=[],imagesUpdated=[],duplicatesSkipped=[];
const seenUrls=new Set(),seenTitles=new Set();

for(const source of sources){
  try{
    const xml=await fetchFeed(source);
    for(const item of items(xml).slice(0,6)){
      const title=tag(item,'title'),rawUrl=linkValue(item),publishedAt=publicationDate(item);
      if(!title||!rawUrl)continue;
      const url=normalizeUrl(rawUrl),titleKey=normalizeTitle(title);
      if(!url||!titleKey)continue;
      if(seenUrls.has(url)||seenTitles.has(titleKey)){duplicatesSkipped.push({title,url,source:source.name,reason:'duplicado no lote atual'});continue;}
      const nearDuplicate=existingArticles.find(a=>isNearDuplicate(title,a.title||''));
      if(nearDuplicate){seenUrls.add(url);seenTitles.add(titleKey);duplicatesSkipped.push({title,url,source:source.name,reason:'título muito semelhante a matéria já cadastrada',existing_id:nearDuplicate.id,existing_title:nearDuplicate.title});continue;}
      let image_url=firstImageFromRss(item); if(!image_url)image_url=await imageFromArticlePage(rawUrl);
      const existingByUrl=await findArticleByUrl(url); const existingByTitle=existingByUrl||await findArticleByTitle(title);
      if(existingByTitle){seenUrls.add(url);seenTitles.add(titleKey);if(!existingByTitle.image_url&&image_url){await updateArticleImage(existingByTitle.id,image_url,publishedAt);imagesUpdated.push({id:existingByTitle.id,title,source:source.name,image_url});}duplicatesSkipped.push({title,url,source:source.name,reason:'já cadastrado'});continue;}
      const article=await insertArticle({title,url,summary:tag(item,'description')||tag(item,'summary'),language:source.language,image_url,published_at:publishedAt});
      await attachSource(article.id,source.id,title,url);
      existingArticles.push({id:article.id,title,original_url:url,image_url,published_at:publishedAt});
      seenUrls.add(url);seenTitles.add(titleKey);collected.push({id:article.id,title,source:source.name,image_url:image_url||null});
    }
  }catch(error){console.error(`Falha em ${source.name}:`,error.message);}
}
await writeFile('data/collection-report.json',JSON.stringify({updated_at:new Date().toISOString(),inserted:collected,images_updated:imagesUpdated,duplicates_skipped:duplicatesSkipped},null,2));
console.log(`Novas notícias inseridas no Supabase: ${collected.length}`);console.log(`Imagens preenchidas em notícias existentes: ${imagesUpdated.length}`);console.log(`Duplicadas ignoradas: ${duplicatesSkipped.length}`);
