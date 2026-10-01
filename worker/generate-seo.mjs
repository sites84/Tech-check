import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = 'https://sites84.github.io/Tech-check';
const IMAGE_DIR = 'assets/news';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar configurados.');
const headers = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` };

async function api(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : [];
}
function esc(value = '') { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function slugify(value = '') { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100); }
function markdownToHtml(markdown = '') {
  const lines = String(markdown).replace(/\r\n?/g, '\n').trim().split('\n');
  const out = []; let paragraph = []; let list = [];
  const inline = value => esc(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
  const flushParagraph = () => { if (paragraph.length) { out.push(`<p>${inline(paragraph.join(' '))}</p>`); paragraph = []; } };
  const flushList = () => { if (list.length) { out.push(`<ul>${list.map(item => `<li>${inline(item)}</li>`).join('')}</ul>`); list = []; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushParagraph(); flushList(); continue; }
    const heading = line.match(/^#{2,3}\s+(.+)/);
    if (heading) { flushParagraph(); flushList(); out.push(`<h2>${inline(heading[1])}</h2>`); continue; }
    if (/^[-*]\s+/.test(line)) { flushParagraph(); list.push(line.replace(/^[-*]\s+/, '')); continue; }
    if (/^\d+[.)]\s+/.test(line)) { flushParagraph(); list.push(line.replace(/^\d+[.)]\s+/, '')); continue; }
    flushList(); paragraph.push(line);
  }
  flushParagraph(); flushList();
  return out.join('\n') || '<p>Conteúdo ainda não disponível.</p>';
}
function jsonLd(article, url) {
  const data = { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: article.title, description: article.summary || article.title, datePublished: article.published_at || article.created_at, dateModified: article.updated_at || article.published_at || article.created_at, mainEntityOfPage: { '@type': 'WebPage', '@id': url }, publisher: { '@type': 'Organization', name: 'Tech Check', url: SITE_URL }, author: { '@type': 'Organization', name: 'Tech Check' }, isAccessibleForFree: true };
  if (article.image_url) data.image = [article.image_url];
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
async function optimizeImage(article, sharp) {
  if (!article.image_url) return null;
  const base = slugify(article.slug || article.title || article.id) || article.id;
  const relative = `${IMAGE_DIR}/${base}.webp`;
  try {
    const response = await fetch(article.image_url, { headers: { 'User-Agent': 'Tech-Check/1.0 image optimizer' }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const input = Buffer.from(await response.arrayBuffer());
    const result = await sharp(input, { failOn: 'none' }).resize({ width: 1280, withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer({ resolveWithObject: true });
    await writeFile(join(process.cwd(), relative), result.data);
    const meta = await sharp(result.data).metadata();
    return { url: `${SITE_URL}/${relative}`, width: meta.width || 1280, height: meta.height || 720 };
  } catch (error) { console.warn(`Imagem não otimizada para ${article.id}: ${error.message}`); return null; }
}

async function main() {
  const articles = await api('articles?status=eq.review&select=id,title,slug,summary,content,why_it_matters,future_outlook,image_url,original_url,published_at,created_at,updated_at&order=published_at.desc.nullslast,created_at.desc&limit=1000');
  const categoryLinks = await api('article_categories?select=article_id,category_id');
  const categories = await api('categories?select=id,name');
  const sources = await api('article_sources?select=article_id,source_title,source_url');
  const categoryMap = new Map(categories.map(x => [x.id, x.name]));
  const articleCategory = new Map(categoryLinks.map(x => [x.article_id, categoryMap.get(x.category_id) || 'Tecnologia']));
  const sourceMap = new Map(sources.map(x => [x.article_id, x]));
  let sharp; try { sharp = (await import('sharp')).default; } catch { console.warn('sharp não disponível; usando imagens originais.'); }

  await rm('noticias', { recursive: true, force: true });
  await mkdir(IMAGE_DIR, { recursive: true });
  const sitemap = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">', `<url><loc>https://sites84.github.io/Tech-check/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>`];
  const seenSlugs = new Set(); let generated = 0; let optimized = 0;

  for (const article of articles) {
    let slug = slugify(article.slug || article.title) || `artigo-${article.id}`;
    if (seenSlugs.has(slug)) slug = `${slug}-${article.id.slice(0, 8)}`;
    seenSlugs.add(slug);
    const url = `https://sites84.github.io/Tech-check/noticias/${encodeURIComponent(slug)}/`;
    const category = articleCategory.get(article.id) || 'Tecnologia';
    const source = sourceMap.get(article.id) || {};
    const image = sharp ? await optimizeImage(article, sharp) : null;
    if (image) optimized++;
    const imageUrl = image?.url || article.image_url || '';
    const body = markdownToHtml(article.content || '');
    const why = article.why_it_matters ? `<section class="article-extra"><h2>Por que isso importa</h2><p>${esc(article.why_it_matters)}</p></section>` : '';
    const outlook = article.future_outlook ? `<section class="article-extra"><h2>O que pode acontecer no futuro</h2><p>${esc(article.future_outlook)}</p><small>São cenários possíveis, não previsões garantidas.</small></section>` : '';
    const imageHtml = imageUrl ? `<img class="article-hero-image" src="${esc(imageUrl)}" alt="${esc(article.title)}" width="${image?.width || 1280}" height="${image?.height || 720}" fetchpriority="high" decoding="async">` : '';
    const published = article.published_at || article.created_at;
    const sourceHtml = source.source_url ? `<p class="source"><strong>Fonte original:</strong> <a href="${esc(source.source_url)}" rel="nofollow noopener noreferrer" target="_blank">${esc(source.source_title || source.source_url)}</a></p>` : '';
    const dateText = new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(published));
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(article.title)} | Tech Check</title><meta name="description" content="${esc((article.summary || article.title).slice(0, 160))}"><link rel="canonical" href="${url}"><meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:type" content="article"><meta property="og:site_name" content="Tech Check"><meta property="og:locale" content="pt_BR"><meta property="og:title" content="${esc(article.title)}"><meta property="og:description" content="${esc(article.summary || article.title)}"><meta property="og:url" content="${url}">${imageUrl ? `<meta property="og:image" content="${esc(imageUrl)}"><meta property="og:image:alt" content="${esc(article.title)}">` : ''}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(article.title)}"><meta name="twitter:description" content="${esc(article.summary || article.title)}">${imageUrl ? `<meta name="twitter:image" content="${esc(imageUrl)}">` : ''}<script type="application/ld+json">${jsonLd(article,url)}</script><link rel="stylesheet" href="../../styles.css"><link rel="stylesheet" href="../../article-page.css"></head><body><header class="site-header"><div class="container header-inner"><a class="brand" href="../../">TECH<span>CHECK</span></a><nav aria-label="Navegação principal"><a href="../../#ultimas">Últimas</a><a href="../../#categorias">Categorias</a><a href="../../#curiosidades">Curiosidades</a><a href="../../#historia">História</a></nav></div></header><main class="article-page container"><a class="back-link" href="../../">← Voltar para as notícias</a><article><p class="eyebrow">${esc(category)} · ${dateText}</p><h1>${esc(article.title)}</h1>${imageHtml}<p class="article-lead">${esc(article.summary || '')}</p><div class="article-body">${body}</div>${why}${outlook}${sourceHtml}</article></main></body></html>`;
    await mkdir(`noticias/${slug}`, { recursive: true });
    await writeFile(`noticias/${slug}/index.html`, html);
    const lastmod = new Date(article.updated_at || published).toISOString();
    sitemap.push(`<url><loc>${url}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>0.8</priority>${imageUrl ? `<image:image><image:loc>${esc(imageUrl)}</image:loc><image:title>${esc(article.title)}</image:title></image:image>` : ''}</url>`);
    generated++;
  }
  sitemap.push('</urlset>');
  await writeFile('sitemap.xml', sitemap.join('\n'));
  await writeFile('robots.txt', 'User-agent: *\nAllow: /\nSitemap: https://sites84.github.io/Tech-check/sitemap.xml\n');
  await writeFile('data/seo-report.json', JSON.stringify({ updated_at: new Date().toISOString(), generated_pages: generated, optimized_images: optimized, total_articles: articles.length }, null, 2));
  console.log(`SEO: ${generated} páginas indexáveis, ${optimized} imagens WebP, sitemap e robots.txt atualizados.`);
}
await main();
