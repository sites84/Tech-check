import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const SITE = 'https://sites84.github.io/Tech-check';
const IGNORE = new Set(['.git', '.github', 'node_modules', '.seo-tools', 'assets', 'data', 'noticias-next']);
const xmlEscape = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const decodeEntities = v => String(v ?? '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

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
function tags(html, tagName) { return [...html.matchAll(new RegExp('<' + tagName + '\\b[^>]*>', 'gi'))].map(m => m[0]); }
function attr(tag, name) {
  const m = tag.match(new RegExp('\\\\b' + name + '\\\\s*=\\\\s*["\\']([^"\\']*)["\\']', 'i'));
  return m ? decodeEntities(m[1]).trim() : '';
}
function hasNoindex(html) {
  return tags(html, 'meta').some(t => {
    const n = attr(t, 'name').toLowerCase();
    return (n === 'robots' || n === 'googlebot') && /noindex/i.test(attr(t, 'content'));
  });
}
function getCanonical(html) {
  for (const tag of tags(html, 'link')) {
    if (attr(tag, 'rel').toLowerCase().split(/\s+/).includes('canonical')) return attr(tag, 'href');
  }
  return '';
}
function expectedUrl(relPath) {
  const p = relPath.split(sep).join('/');
  if (p === 'index.html') return SITE + '/';
  if (p.endsWith('/index.html')) return SITE + '/' + p.slice(0, -'index.html'.length);
  if (p.endsWith('.html')) return SITE + '/' + p;
  return '';
}
function textFromHtml(v) { return decodeEntities(String(v ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()); }
function pageTitle(html) {
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return textFromHtml(h1?.[1] || title?.[1] || '');
}
function imageLocations(html, baseUrl) {
  const found = [];
  for (const img of tags(html, 'img')) {
    const src = attr(img, 'src');
    if (!src || /^(data:|blob:|javascript:)/i.test(src)) continue;
    try {
      const url = new URL(src, baseUrl).href;
      if (!found.includes(url)) found.push(url);
    } catch {}
    if (found.length >= 10) break;
  }
  return found;
}
function renderSitemap(urls, withImages) {
  const out = ['<?xml version="1.0" encoding="UTF-8"?>',
    withImages
      ? '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'
      : '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  for (const item of urls) {
    out.push('<url><loc>' + xmlEscape(item.url) + '</loc>');
    if (withImages) {
      for (const image of item.images) out.push('<image:image><image:loc>' + xmlEscape(image) + '</image:loc><image:title>' + xmlEscape(item.title) + '</image:title></image:image>');
    }
    out.push('</url>');
  }
  out.push('</urlset>');
  return out.join('\n') + '\n';
}
async function main() {
  const htmlFiles = await walk('.');
  const mainPages = new Map(), evergreenPages = new Map();
  let noCanonical = 0, noindex = 0, nonSelfCanonical = 0;
  const canonicalIssues = [];
  for (const file of htmlFiles) {
    const rel = relative('.', file).split(sep).join('/');
    const html = await readFile(file, 'utf8');
    if (hasNoindex(html)) { noindex++; continue; }
    const canonical = getCanonical(html);
    if (!canonical) { noCanonical++; continue; }
    const expected = expectedUrl(rel);
    if (!expected) continue;
    let normalizedCanonical = '';
    try { normalizedCanonical = new URL(canonical, SITE + '/').href; } catch {}
    if (normalizedCanonical.replace(/\/+$/, '') !== expected.replace(/\/+$/, '')) {
      nonSelfCanonical++;
      if (canonicalIssues.length < 25) canonicalIssues.push({path: rel, expected, canonical: normalizedCanonical});
      continue;
    }
    const record = {url: expected, title: pageTitle(html), images: imageLocations(html, expected)};
    const isEvergreen = /^(curiosidades|tutoriais|comparativos|historia-da-tecnologia)\//.test(rel);
    (isEvergreen ? evergreenPages : mainPages).set(expected, record);
  }
  const mainUrls = [...mainPages.values()].sort((a,b) => a.url.localeCompare(b.url));
  const evergreenUrls = [...evergreenPages.values()].sort((a,b) => a.url.localeCompare(b.url));
  if (!mainUrls.some(x => x.url === SITE + '/')) throw new Error('A Home não tem canonical próprio e indexável.');
  if (mainUrls.length < 100) throw new Error('Sitemap principal inesperadamente pequeno: ' + mainUrls.length + ' URLs.');
  if (evergreenUrls.length < 30) throw new Error('Sitemap evergreen inesperadamente pequeno: ' + evergreenUrls.length + ' URLs.');
  await writeFile('sitemap.xml', renderSitemap(mainUrls, true));
  await writeFile('sitemap-evergreen.xml', renderSitemap(evergreenUrls, false));
  await writeFile('robots.txt', 'User-agent: *\nAllow: /\nSitemap: ' + SITE + '/sitemap.xml\nSitemap: ' + SITE + '/sitemap-evergreen.xml\n');
  await mkdir('data', {recursive:true});
  const report = {generated_at:new Date().toISOString(), scanned_html:htmlFiles.length, main_sitemap_urls:mainUrls.length, evergreen_sitemap_urls:evergreenUrls.length, noindex_pages:noindex, pages_without_canonical:noCanonical, non_self_canonical_pages:nonSelfCanonical, non_self_canonical_sample:canonicalIssues};
  await writeFile('data/sitemap-generation-report.json', JSON.stringify(report, null, 2) + '\n');
  console.log('Sitemaps recriados a partir do HTML realmente publicável: ' + mainUrls.length + ' URLs principais; ' + evergreenUrls.length + ' URLs evergreen; ' + noindex + ' noindex excluídas; ' + nonSelfCanonical + ' canonicals divergentes excluídos.');
}
main().catch(e => { console.error(e); process.exit(1); });
