import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !KEY) throw new Error('Supabase env ausente');

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const SITE_ROOT = 'noticias';

async function api(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : [];
}

function esc(v = '') {
  return String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function norm(v = '') {
  return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function keywords(value) {
  if (Array.isArray(value)) return value.map(norm).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(norm).filter(Boolean);
    } catch {}
    return value.split(/[,;|]/).map(norm).filter(Boolean);
  }
  return [];
}

function chooseProduct(article, category, products) {
  const text = norm(`${article.title || ''} ${article.summary || ''} ${category || ''}`);
  const categoryMap = {
    'inteligencia artificial':'IA e criação', 'ia':'IA e criação',
    'smartphones':'Celulares', 'celulares':'Celulares',
    'computadores':'Computadores', 'games':'Games',
    'segurança':'Acessórios', 'seguranca':'Acessórios',
    'ciência':'Acessórios', 'ciencia':'Acessórios', 'espaço':'Acessórios', 'espaco':'Acessórios',
    'gadgets':'Acessórios', 'internet':'Redes', 'empresas':'Notebooks',
    'história da tecnologia':'Computadores', 'historia da tecnologia':'Computadores'
  };
  let best = null, bestScore = -1;
  for (const p of products) {
    if (!p?.affiliate_url) continue;
    const pc = norm(p.category || '');
    const pn = norm(p.product_name || '');
    let score = 0;
    if (pc && text.includes(pc)) score += 8;
    for (const [key, target] of Object.entries(categoryMap)) {
      if (text.includes(key) && pc === norm(target)) score += 7;
    }
    for (const key of keywords(p.keywords)) if (key.length > 2 && text.includes(key)) score += 4;
    for (const word of pn.split(/\s+/)) if (word.length > 3 && text.includes(word)) score += 2;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best || products.find(p => p?.affiliate_url) || null;
}

function affiliateHtml(product) {
  const image = product.image_url
    ? `<a class="affiliate-image-link" href="${esc(product.affiliate_url)}" target="_blank" rel="sponsored noopener noreferrer"><img class="affiliate-product-image" src="${esc(product.image_url)}" alt="${esc(product.product_name || 'Produto relacionado')}" loading="lazy" referrerpolicy="no-referrer"></a>`
    : '';
  return `<section class="affiliate-box"><p class="eyebrow">PRODUTO RELACIONADO</p>${image}<h3>${esc(product.product_name || 'Produto relacionado')}</h3><p>Clique abaixo e confira este produto em oferta</p><a class="affiliate-button" href="${esc(product.affiliate_url)}" target="_blank" rel="sponsored noopener noreferrer">Grandes ofertas</a></section>`;
}

async function main() {
  const [articles, links, cats, products] = await Promise.all([
    api('articles?status=eq.review&select=id,title,slug,summary'),
    api('article_categories?select=article_id,category_id'),
    api('categories?select=id,name'),
    api('affiliate_products?active=eq.true&select=category,product_name,affiliate_url,keywords,image_url')
  ]);
  const categoryMap = new Map(cats.map(c => [c.id, c.name]));
  const articleCategory = new Map(links.map(x => [x.article_id, categoryMap.get(x.category_id) || 'Tecnologia']));
  const articleMap = new Map(articles.map(a => [a.slug, a]));
  const dirs = await readdir(SITE_ROOT, { withFileTypes: true });
  let changed = 0;

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const file = join(SITE_ROOT, dir.name, 'index.html');
    let html;
    try { html = await readFile(file, 'utf8'); } catch { continue; }
    if (html.includes('class="affiliate-box"')) continue;
    const article = articleMap.get(dir.name);
    if (!article) continue;
    const product = chooseProduct(article, articleCategory.get(article.id) || '', products);
    if (!product?.affiliate_url) continue;
    if (!html.includes('../../affiliate.css')) {
      html = html.replace('</head>', '<link rel="stylesheet" href="../../affiliate.css"></head>');
    }
    html = html.replace('</article>', `${affiliateHtml(product)}</article>`);
    await writeFile(file, html);
    changed++;
  }
  console.log(`Afiliados nas páginas individuais: ${changed} páginas atualizadas.`);
}

await main();
