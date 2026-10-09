import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE = 'https://sites84.github.io/Tech-check';
if (!SUPABASE_URL || !KEY) throw new Error('Supabase env ausente para gerar sitemap canônico.');
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const IGNORE = new Set(['.git', '.github', 'node_modules', '.seo-tools', 'assets', 'data', 'noticias-next']);
const xmlEscape = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const decodeEntities = v => String(v ?? '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function api(path) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + path, { headers: H });
  if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 500));
  return r.json();
}
async function walk(dir, out = []) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    if (entry.isDirectory() && (IGNORE.has(entry.name) || entry.name.startsWith('.'))) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) out.push(full);
  }
  return out;
}
function tags(html, name) { return [...html.matchAll(new RegExp('<' + name + '\\b[^>]*>', 'gi'))].map(m => m[0]); }
function attr(tag, name) {
  const dq = tag.match(new RegExp("\\b" + name + "\\s*=\\s*\"([^\"]*)\"", "i"));
  const sq = tag.match(new RegExp("\\b" + name + "\\s*=\\s*'([^']*)'", "i"));
  const m = dq || sq;
  return m ? decodeEntities(m[1]).trim() : '';
}
function hasNoindex(html) {
  return tags(html, 'meta').some(t => {
    const n = attr(t, 'name').toLowerCase();
    return (n === 'robots' || n === 'googlebot') && /noindex/i.test(attr(t, 'content'));
  });
}
function canonicalOf(html) {
  for (const tag of tags(html, 'link')) if (attr(tag, 'rel').toLowerCase().split(/\s+/).includes('canonical')) return attr(tag, 'href');
  return '';
}
function expectedUrl(relPath) {
  const p = relPath.split(sep).join('/');
  if (p === 'index.html') return SITE + '/';
  if (p.endsWith('/index.html')) return SITE + '/' + p.slice(0, -'index.html'.length);
  if (p.endsWith('.html')) return SITE + '/' + p;
  return '';
}
function titleOf(html) {
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return decodeEntities(String(h1?.[1] || title?.[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}
function normalizeTitle(v = '') { return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/https?:\/\/[^\s]+/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }
function tokens(v = '') { return new Set(normalizeTitle(v).split(' ').filter(w => w.length > 2)); }
function similarity(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let n = 0; for (const t of A) if (B.has(t)) n++;
  const j = n / (A.size + B.size - n), c = n / Math.min(A.size, B.size);
  return Math.max(j, c * .9);
}
function normalizeSource(v = '') {
  try {
    const u = new URL(v); u.hash = '';
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid'].forEach(k => u.searchParams.delete(k));
    return u.hostname.toLowerCase() + u.pathname.replace(/\/+$/, '').toLowerCase();
  } catch { return String(v || '').trim().toLowerCase(); }
}
function imageLocations(html, baseUrl) {
  const found = [];
  for (const img of tags(html, 'img')) {
    const src = attr(img, 'src');
    if (!src || /^(data:|blob:|javascript:)/i.test(src)) continue;
    try { const u = new URL(src, baseUrl).href; if (!found.includes(u)) found.push(u); } catch {}
    if (found.length >= 10) break;
  }
  return found;
}
function renderSitemap(list, withImages) {
  const out = ['<?xml version="1.0" encoding="UTF-8"?>',
    withImages ? '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' : '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  for (const item of list) {
    out.push('<url><loc>' + xmlEscape(item.url) + '</loc>');
    if (withImages) for (const image of item.images || []) out.push('<image:image><image:loc>' + xmlEscape(image) + '</image:loc><image:title>' + xmlEscape(item.title) + '</image:title></image:image>');
    out.push('</url>');
  }
  out.push('</urlset>');
  return out.join('\n') + '\n';
}
async function main() {
  const [articles, htmlFiles] = await Promise.all([
    api('articles?status=eq.review&select=id,title,slug,summary,original_url,cached_image_url,image_url,published_at,created_at&order=published_at.desc.nullslast,created_at.desc&limit=1000'),
    walk('.')
  ]);
  const uniqueArticles = [], duplicateIds = [];
  for (const a of articles) {
    const source = normalizeSource(a.original_url || '');
    const dupe = uniqueArticles.some(x =>
      (source && normalizeSource(x.original_url || '') === source) ||
      similarity(x.title || '', a.title || '') >= .92
    );
    if (dupe) { duplicateIds.push(a.id); continue; }
    uniqueArticles.push(a);
  }
  const mainPages = new Map(), evergreenPages = new Map();
  const issues = { missing_news_page: [], news_noindex: [], news_canonical_mismatch: [], no_canonical: 0, noindex: 0, alias_or_nonself_canonical: 0 };
  const fileHtml = new Map();
  for (const file of htmlFiles) fileHtml.set(relative('.', file).split(sep).join('/'), await readFile(file, 'utf8'));
  const rootUrl = SITE + '/';
  const rootHtml = fileHtml.get('index.html') || '';
  if (rootHtml && !hasNoindex(rootHtml) && canonicalOf(rootHtml).replace(/\/+$/, '') === rootUrl.replace(/\/+$/, '')) mainPages.set(rootUrl, {url: rootUrl, title: titleOf(rootHtml), images: imageLocations(rootHtml, rootUrl)});

  for (const a of uniqueArticles) {
    const slug = String(a.slug || '').trim();
    if (!slug) { issues.missing_news_page.push({id:a.id,title:a.title,reason:'slug ausente'}); continue; }
    const path = 'noticias/' + slug + '/index.html';
    const html = fileHtml.get(path);
    const url = SITE + '/noticias/' + encodeURIComponent(slug) + '/';
    if (!html) { issues.missing_news_page.push({id:a.id,title:a.title,slug,reason:'HTML não encontrado'}); continue; }
    if (hasNoindex(html)) { issues.news_noindex.push({id:a.id,title:a.title,slug}); continue; }
    const canonical = canonicalOf(html);
    if (!canonical || new URL(canonical, SITE + '/').href.replace(/\/+$/, '') !== url.replace(/\/+$/, '')) {
      issues.news_canonical_mismatch.push({id:a.id,title:a.title,slug,canonical:canonical||'(ausente)'}); continue;
    }
    mainPages.set(url, {url,title:titleOf(html)||a.title||'',images:imageLocations(html,url)});
  }

  const evergreenFolders = /^(curiosidades|tutoriais|comparativos|historia-da-tecnologia)\//;
  for (const [path, html] of fileHtml.entries()) {
    if (path === 'index.html' || path.startsWith('noticias/')) continue;
    if (hasNoindex(html)) { issues.noindex++; continue; }
    const canonical = canonicalOf(html);
    if (!canonical) { issues.no_canonical++; continue; }
    const expected = expectedUrl(path);
    if (!expected) continue;
    if (new URL(canonical, SITE + '/').href.replace(/\/+$/, '') !== expected.replace(/\/+$/, '')) {
      issues.alias_or_nonself_canonical++; continue;
    }
    const record = {url:expected,title:titleOf(html),images:imageLocations(html,expected)};
    (evergreenFolders.test(path) ? evergreenPages : mainPages).set(expected, record);
  }
  const mainList = [...mainPages.values()].sort((a,b)=>a.url.localeCompare(b.url));
  const evergreenList = [...evergreenPages.values()].sort((a,b)=>a.url.localeCompare(b.url));
  if (!mainList.some(x=>x.url===rootUrl)) throw new Error('A Home não tem canonical próprio e indexável.');
  if (mainList.length < 100) throw new Error('Sitemap principal pequeno demais: ' + mainList.length + ' URLs.');
  if (evergreenList.length < 30) throw new Error('Sitemap evergreen pequeno demais: ' + evergreenList.length + ' URLs.');
  await writeFile('sitemap.xml',renderSitemap(mainList,true));
  await writeFile('sitemap-evergreen.xml',renderSitemap(evergreenList,false));
  await writeFile('robots.txt','User-agent: *\nAllow: /\nSitemap: '+SITE+'/sitemap.xml\nSitemap: '+SITE+'/sitemap-evergreen.xml\n');
  await mkdir('data',{recursive:true});
  const report = {generated_at:new Date().toISOString(),html_files_scanned:htmlFiles.length,articles_in_database:articles.length,unique_news_articles:uniqueArticles.length,duplicate_news_articles_excluded:duplicateIds.length,news_pages_in_sitemap:mainList.filter(x=>x.url.includes('/noticias/')).length,main_sitemap_urls:mainList.length,evergreen_sitemap_urls:evergreenList.length,issues,duplicate_article_ids_sample:duplicateIds.slice(0,30)};
  await writeFile('data/sitemap-generation-report.json',JSON.stringify(report,null,2)+'\n');
  console.log('Sitemaps recriados do HTML canônico: '+mainList.length+' URLs principais, '+evergreenList.length+' evergreen; '+duplicateIds.length+' notícias duplicadas excluídas; '+issues.missing_news_page.length+' notícias sem HTML; '+issues.news_canonical_mismatch.length+' canonicals divergentes.');
}
main().catch(e=>{console.error(e);process.exit(1);});
