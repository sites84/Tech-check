import { mkdir, readdir, writeFile } from 'node:fs/promises';

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE = 'https://sites84.github.io/Tech-check';
if (!SUPABASE_URL || !KEY) throw new Error('Supabase env ausente');
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slugify = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const clean = v => String(v ?? '').replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n').trim();

async function api(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 500)}`);
  return r.json();
}

function markdown(value = '') {
  const lines = clean(value).split(/\n+/).map(x => x.trim()).filter(Boolean)
    .filter((x, i) => !(i === 0 && /^TL;DR\s*:/i.test(x)));
  const out = [];
  let paragraph = [], list = [], ordered = false;
  const flushP = () => { if (paragraph.length) { out.push(`<p>${esc(paragraph.join(' ')).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`); paragraph = []; } };
  const flushL = () => {
    if (!list.length) return;
    out.push(ordered ? `<ol>${list.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : `<ul>${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`);
    list = []; ordered = false;
  };
  for (const line of lines) {
    const heading = line.match(/^#{2,3}\s+(.+)/);
    const numbered = line.match(/^\d+[.)]\s+(.+)/);
    if (heading) { flushP(); flushL(); out.push(`<h2>${esc(heading[1])}</h2>`); continue; }
    if (/^[-*]\s+/.test(line)) { flushP(); if (ordered && list.length) flushL(); list.push(line.replace(/^[-*]\s+/, '')); continue; }
    if (numbered) { flushP(); if (!ordered && list.length) flushL(); ordered = true; list.push(numbered[1]); continue; }
    flushL(); paragraph.push(line);
  }
  flushP(); flushL();
  return out.join('\n') || '<p>Conteúdo em atualização.</p>';
}

function articleBody(item) {
  if (item.content_type !== 'curiosity') return markdown(item.content);
  const lines = clean(item.content).split(/\n+/).map(x => x.trim()).filter(Boolean)
    .filter((x, i) => !(i === 0 && /^TL;DR\s*:/i.test(x)));
  const lead = [], groups = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(/^(\d+)\.\s*(.*)$/);
    if (m) { current = { number: m[1], title: m[2], paragraphs: [] }; groups.push(current); }
    else if (current) current.paragraphs.push(line);
    else lead.push(line);
  }
  return lead.map(x => `<p>${esc(x)}</p>`).join('') +
    groups.map(g => `<section class="article-list-item"><h2>${esc(g.number)}. ${esc(g.title)}</h2>${g.paragraphs.map(p => `<p>${esc(p)}</p>`).join('')}</section>`).join('');
}

function schemaFor(item, url) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: item.title,
    description: item.summary || item.title,
    inLanguage: 'pt-BR',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Organization', name: 'Tech Check', url: SITE + '/' },
    publisher: { '@type': 'Organization', name: 'Tech Check', url: SITE + '/', logo: { '@type': 'ImageObject', url: SITE + '/favicon.png' } },
    isAccessibleForFree: true
  };
  const published = item.published_at || item.created_at;
  if (published) data.datePublished = published;
  const images = [item.image_url, item.image_url_2].filter(Boolean);
  if (images.length) data.image = images;
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function page(item, url, folder) {
  const type = item.content_type;
  const label = type === 'tutorial' ? 'TUTORIAL' : type === 'comparison' ? 'COMPARATIVO' : type === 'fundamental' ? 'FUNDAMENTO DE TECNOLOGIA' : type === 'history' ? 'HISTÓRIA DA TECNOLOGIA' : 'CURIOSIDADE EM LISTA';
  const imageTag = (src, alt) => src ? `<img class="article-feature-image" src="${esc(src)}" alt="${esc(alt)}" loading="eager" decoding="async">` : '';
  const images = type === 'comparison'
    ? `<div class="comparison-images">${imageTag(item.image_url, item.title + ' — produto A')}${imageTag(item.image_url_2, item.title + ' — produto B')}</div>`
    : imageTag(item.image_url, item.title);
  const nav = `<header class="site-header"><div class="container header-inner"><a class="brand" href="../../">TECH<span>CHECK</span></a><nav aria-label="Navegação principal"><a href="../../#categorias-feed">Categorias</a><a href="../../curiosidades/">Curiosidades</a><a href="../../tutoriais/">Tutoriais</a><a href="../../comparativos/">Comparativos</a><a href="../../historia-da-tecnologia/">História</a></nav></div></header>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(item.title)} | Tech Check</title><meta name="description" content="${esc((item.summary || item.title || '').replace(/\s+/g, ' ').slice(0, 155))}"><link rel="canonical" href="${url}"><meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:type" content="article"><meta property="og:site_name" content="Tech Check"><meta property="og:title" content="${esc(item.title)}"><meta property="og:description" content="${esc(item.summary || item.title)}"><meta property="og:url" content="${url}">${item.image_url ? `<meta property="og:image" content="${esc(item.image_url)}">` : ''}<meta name="twitter:card" content="summary_large_image"><script type="application/ld+json">${schemaFor(item, url)}</script><link rel="icon" href="../../favicon.ico"><link rel="stylesheet" href="../../styles.css"><link rel="stylesheet" href="../../evergreen.css?v=5"><link rel="stylesheet" href="../../special-pages.css?v=5"><link rel="stylesheet" href="../../article-dark-mode.css"></head><body>${nav}<main class="container special-page"><article class="evergreen-special-card curiosity-article"><p class="eyebrow">${label}</p><h1>${esc(item.title)}</h1><div class="article-tldr"><strong>RESUMO</strong><p>${esc(item.summary || '')}</p></div>${images}<div class="article-body">${articleBody(item)}</div><nav class="article-bottom-nav" aria-label="Mais conteúdo"><a href="../../${folder}/">Ver mais ${label.toLowerCase()}</a><a href="../../">Página inicial</a></nav></article></main></body></html>`;
}

function hubPage(title, description, folder, items) {
  const cards = items.map(item => {
    const slug = `${item.id}-${slugify(item.title)}`;
    return `<article class="evergreen-card">${item.image_url ? `<img class="evergreen-card-image" src="${esc(item.image_url)}" alt="${esc(item.title)}" loading="lazy" decoding="async">` : ''}<div class="evergreen-card-top"><span>${folder === 'tutoriais' ? 'TUTORIAL' : 'COMPARATIVO'}</span></div><h2>${esc(item.title)}</h2><p class="evergreen-summary">${esc(item.summary || '')}</p><a class="evergreen-read" href="./${slug}/">Ler matéria</a></article>`;
  }).join('');
  const url = `${SITE}/${folder}/`;
  const itemList = items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.title, url: `${url}${item.id}-${slugify(item.title)}/` }));
  const schema = JSON.stringify({ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description, url, inLanguage: 'pt-BR', isPartOf: { '@type': 'WebSite', name: 'Tech Check', url: SITE + '/' }, mainEntity: { '@type': 'ItemList', itemListElement: itemList } }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Tech Check</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${url}"><meta name="robots" content="index,follow"><meta property="og:type" content="website"><meta property="og:site_name" content="Tech Check"><meta property="og:title" content="${esc(title)} | Tech Check"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}"><script type="application/ld+json">${schema}</script><link rel="icon" href="../favicon.ico"><link rel="stylesheet" href="../styles.css"><link rel="stylesheet" href="../evergreen.css?v=5"><link rel="stylesheet" href="../special-pages.css?v=5"><link rel="stylesheet" href="../article-dark-mode.css"></head><body><header class="site-header"><div class="container header-inner"><a class="brand" href="../">TECH<span>CHECK</span></a><nav aria-label="Navegação principal"><a href="../#categorias-feed">Categorias</a><a href="../curiosidades/">Curiosidades</a><a href="../tutoriais/">Tutoriais</a><a href="../comparativos/">Comparativos</a><a href="../historia-da-tecnologia/">História</a></nav></div></header><main class="container evergreen-special"><p class="eyebrow">TECH CHECK</p><h1>${esc(title)}</h1><p class="evergreen-special-intro">${esc(description)}</p><section class="evergreen-grid special-hub-grid">${cards}</section></main></body></html>`;
}

async function writeLegacyRedirects(folder, canonicalSlug, item, canonicalUrl) {
  let dirs = [];
  try { dirs = await readdir(folder, { withFileTypes: true }); } catch { return 0; }
  let count = 0;
  for (const entry of dirs) {
    if (!entry.isDirectory() || !entry.name.startsWith(`${item.id}-`) || entry.name === canonicalSlug) continue;
    const rel = `../${canonicalSlug}/`;
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="canonical" href="${canonicalUrl}"><meta http-equiv="refresh" content="0;url=${rel}"><title>Matéria movida | Tech Check</title></head><body><p>Esta matéria foi movida. <a href="${rel}">Abrir a versão atualizada</a>.</p><script>location.replace(${JSON.stringify(rel)})</script></body></html>`;
    await writeFile(`${folder}/${entry.name}/index.html`, html);
    count++;
  }
  return count;
}

async function main() {
  const items = await api('tech_evergreen_content?active=eq.true&select=id,content_type,title,summary,content,image_url,image_url_2,sort_order,published_at,created_at&order=content_type.asc,sort_order.asc&limit=1000');
  const supported = items.filter(x => ['curiosity', 'fundamental', 'tutorial', 'comparison'].includes(x.content_type));
  const grouped = {
    curiosity: supported.filter(x => x.content_type === 'curiosity'),
    fundamental: supported.filter(x => x.content_type === 'fundamental'),
    tutorial: supported.filter(x => x.content_type === 'tutorial'),
    comparison: supported.filter(x => x.content_type === 'comparison')
  };
  const allEntries = new Set([`${SITE}/curiosidades/`, `${SITE}/tutoriais/`, `${SITE}/comparativos/`]);
  let pages = 0, aliases = 0;
  for (const item of supported) {
    const folder = item.content_type === 'curiosity' || item.content_type === 'fundamental' ? 'curiosidades' : item.content_type === 'tutorial' ? 'tutoriais' : 'comparativos';
    const slug = `${item.id}-${slugify(item.title)}`;
    const dir = `${folder}/${slug}`;
    const url = `${SITE}/${dir}/`;
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/index.html`, page(item, url, folder));
    aliases += await writeLegacyRedirects(folder, slug, item, url);
    allEntries.add(url);
    pages++;
  }
  await mkdir('tutoriais', { recursive: true });
  await mkdir('comparativos', { recursive: true });
  await writeFile('tutoriais/index.html', hubPage('Tutoriais de tecnologia: passo a passo', 'Guias didáticos em português para resolver problemas de celulares, computadores, aplicativos, armazenamento e internet.', 'tutoriais', grouped.tutorial));
  await writeFile('comparativos/index.html', hubPage('Comparativos de tecnologia', 'Análises práticas de produtos e plataformas para comparar recursos, diferenças, limitações e qual opção combina com seu uso.', 'comparativos', grouped.comparison));
  const sitemap = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...[...allEntries].sort().map(url => `<url><loc>${esc(url)}</loc></url>`), '</urlset>'];
  await writeFile('sitemap-evergreen.xml', sitemap.join('\n'));
  await writeFile('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\nSitemap: ${SITE}/sitemap-evergreen.xml\n`);
  await mkdir('data', { recursive: true });
  await writeFile('data/evergreen-seo-report.json', JSON.stringify({ generated_at: new Date().toISOString(), active_items: supported.length, pages_generated: pages, legacy_aliases_redirected: aliases, sitemap_urls: allEntries.size, by_type: Object.fromEntries(Object.entries(grouped).map(([k,v]) => [k,v.length])) }, null, 2));
  console.log(`Evergreen SEO: ${pages} páginas geradas; ${aliases} URLs antigas redirecionadas; ${allEntries.size} URLs no sitemap-evergreen.xml.`);
}

main().catch(error => { console.error(error); process.exit(1); });
