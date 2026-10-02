// Feed público com deduplicação final por URL e título. Alteração de versão para forçar a reconstrução do latest.json.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar configurados nos secrets do GitHub.');
}

async function request(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${text}`);
  if (!text.trim()) return null;
  try { return JSON.parse(text); } catch { throw new Error(`Resposta inválida do Supabase: ${text.slice(0, 300)}`); }
}

function normalizeUrl(value = '') {
  try {
    const u = new URL(String(value).trim());
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|ref$|source$)/i.test(key)) u.searchParams.delete(key);
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    u.pathname = u.pathname.replace(/\/+$/, '') || '/';
    return u.toString();
  } catch { return String(value).trim().replace(/[?#].*$/, '').replace(/\/$/, ''); }
}

function normalizeTitle(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function titleSimilarity(a, b) {
  const A = new Set(normalizeTitle(a).split(' ').filter(w => w.length > 2));
  const B = new Set(normalizeTitle(b).split(' ').filter(w => w.length > 2));
  if (!A.size || !B.size) return 0;
  let intersection = 0;
  for (const token of A) if (B.has(token)) intersection++;
  const jaccard = intersection / (A.size + B.size - intersection);
  const containment = intersection / Math.min(A.size, B.size);
  return Math.max(jaccard, containment * 0.9);
}

function isDuplicatePublicArticle(article, existing) {
  const articleUrl = normalizeUrl(article.original_url || '');
  const existingUrl = normalizeUrl(existing.original_url || '');
  if (articleUrl && existingUrl && articleUrl === existingUrl) return true;
  const articleTitle = normalizeTitle(article.title || '');
  const existingTitle = normalizeTitle(existing.title || '');
  if (articleTitle && existingTitle && articleTitle === existingTitle) return true;
  return articleTitle.length >= 35 && existingTitle.length >= 35 && titleSimilarity(articleTitle, existingTitle) >= 0.94;
}

export async function getSources() { return request('sources?active=eq.true&select=*') || []; }
export async function findArticleByUrl(url) { const rows = await request(`articles?original_url=eq.${encodeURIComponent(url)}&select=id,title,image_url,original_url&limit=1`) || []; return rows[0] || null; }
export async function findArticleByTitle(title) { const rows = await request(`articles?title=eq.${encodeURIComponent(title)}&select=id,title,image_url,original_url&limit=1`) || []; return rows[0] || null; }
export async function getRecentArticleTitles(limit = 500) { return request(`articles?select=id,title,original_url,image_url&order=created_at.desc&limit=${limit}`) || []; }
export async function updateArticleImage(id, image_url) { await request(`articles?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ image_url, updated_at: new Date().toISOString() }) }); }
export async function insertArticle(item) {
  const slug = `${item.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)}-${Date.now()}`;
  const rows = await request('articles', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ title: item.title, slug, summary: item.summary || null, original_language: item.language || 'en', original_url: item.url, image_url: item.image_url || null, status: 'draft', verification_level: 'single_source' }) });
  if (!Array.isArray(rows) || !rows[0]) throw new Error('Supabase não retornou o artigo criado.');
  return rows[0];
}
export async function attachSource(articleId, sourceId, title, url) { await request('article_sources', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify({ article_id: articleId, source_id: sourceId, source_title: title, source_url: url }) }); }
export async function getDraftArticles(limit = 8) { return request(`articles?status=eq.draft&select=id,title,summary,original_language,original_url,image_url,created_at&order=created_at.asc&limit=${limit}`) || []; }
export async function getShortReviewArticles(limit = 5) { return request(`articles?status=eq.review&content=not.is.null&select=id,title,summary,original_language,original_url,image_url,created_at,content&order=created_at.desc&limit=50`).then(rows => (rows || []).filter(article => (article.content || '').length < 1800).slice(0, limit)); }
export async function updateArticle(id, data) { await request(`articles?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }) }); }
export async function getCategoryByName(name) { const rows = await request(`categories?name=eq.${encodeURIComponent(name)}&select=id,name&limit=1`) || []; return rows[0] || null; }
export async function attachCategory(articleId, categoryId) { await request('article_categories', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify({ article_id: articleId, category_id: categoryId }) }); }

export async function getPublishedArticles(limit = 1000) {
  const articles = await request(`articles?status=eq.review&select=id,title,slug,summary,content,why_it_matters,future_outlook,image_url,original_url,verification_level,published_at,created_at&order=published_at.desc.nullslast,created_at.desc&limit=${limit}`) || [];
  if (!articles.length) return [];
  const ids = articles.map(article => article.id);
  const idFilter = `in.(${ids.join(',')})`;
  const [sources, categoryLinks, categories] = await Promise.all([
    request(`article_sources?article_id=${idFilter}&select=article_id,source_title,source_url`),
    request(`article_categories?article_id=${idFilter}&select=article_id,category_id`),
    request('categories?select=id,name')
  ]);
  const sourceMap = new Map();
  for (const source of sources || []) if (!sourceMap.has(source.article_id)) sourceMap.set(source.article_id, source);
  const categoryMap = new Map((categories || []).map(category => [category.id, category.name]));
  const articleCategory = new Map();
  for (const link of categoryLinks || []) if (!articleCategory.has(link.article_id)) articleCategory.set(link.article_id, categoryMap.get(link.category_id) || 'Tecnologia');

  const unique = [];
  let duplicateCount = 0;
  for (const article of articles) {
    if (unique.some(existing => isDuplicatePublicArticle(article, existing))) { duplicateCount++; continue; }
    unique.push(article);
  }
  if (duplicateCount) console.log(`Feed público: ${duplicateCount} duplicatas removidas da saída.`);

  return unique.map(article => {
    const source = sourceMap.get(article.id);
    return { ...article, category: articleCategory.get(article.id) || 'Tecnologia', source: source?.source_title || 'Fonte original', source_url: source?.source_url || article.original_url };
  });
}
