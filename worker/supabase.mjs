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

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Resposta inválida do Supabase: ${text.slice(0, 300)}`);
  }
}

export async function getSources() { return request('sources?active=eq.true&select=*') || []; }

export async function findArticleByUrl(url) {
  const rows = await request(`articles?original_url=eq.${encodeURIComponent(url)}&select=id,image_url&limit=1`) || [];
  return rows[0] || null;
}

export async function updateArticleImage(id, image_url) {
  await request(`articles?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ image_url, updated_at: new Date().toISOString() })
  });
}

export async function insertArticle(item) {
  const slug = `${item.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)}-${Date.now()}`;
  const rows = await request('articles', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      title: item.title,
      slug,
      summary: item.summary || null,
      original_language: item.language || 'en',
      original_url: item.url,
      image_url: item.image_url || null,
      status: 'draft',
      verification_level: 'single_source'
    })
  });
  if (!Array.isArray(rows) || !rows[0]) throw new Error('Supabase não retornou o artigo criado.');
  return rows[0];
}

export async function attachSource(articleId, sourceId, title, url) {
  await request('article_sources', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify({ article_id: articleId, source_id: sourceId, source_title: title, source_url: url })
  });
}

export async function getDraftArticles(limit = 8) {
  return request(`articles?status=eq.draft&select=id,title,summary,original_language,original_url,image_url,created_at&order=created_at.asc&limit=${limit}`) || [];
}

export async function getShortReviewArticles(limit = 5) {
  return request(`articles?status=eq.review&content=not.is.null&select=id,title,summary,original_language,original_url,image_url,created_at,content&order=created_at.desc&limit=50`) .then(rows => (rows || []).filter(article => (article.content || '').length < 1800).slice(0, limit));
}

export async function updateArticle(id, data) {
  await request(`articles?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ ...data, updated_at: new Date().toISOString() })
  });
}

export async function getCategoryByName(name) {
  const rows = await request(`categories?name=eq.${encodeURIComponent(name)}&select=id,name&limit=1`) || [];
  return rows[0] || null;
}

export async function attachCategory(articleId, categoryId) {
  await request('article_categories', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify({ article_id: articleId, category_id: categoryId })
  });
}

export async function getPublishedArticles(limit = 30) {
  const articles = await request(`articles?status=eq.review&select=id,title,slug,summary,content,why_it_matters,future_outlook,image_url,original_url,verification_level,published_at,created_at&order=published_at.desc.nullslast,created_at.desc&limit=${limit}`) || [];

  const result = [];
  for (const article of articles) {
    const links = await request(`article_sources?article_id=eq.${encodeURIComponent(article.id)}&select=source_title,source_url&limit=1`) || [];
    const categoryLinks = await request(`article_categories?article_id=eq.${encodeURIComponent(article.id)}&select=category_id&limit=1`) || [];
    let category = 'Tecnologia';
    if (categoryLinks[0]?.category_id) {
      const categories = await request(`categories?id=eq.${encodeURIComponent(categoryLinks[0].category_id)}&select=name&limit=1`) || [];
      category = categories[0]?.name || category;
    }
    result.push({
      ...article,
      category,
      source: links[0]?.source_title || 'Fonte original',
      source_url: links[0]?.source_url || article.original_url
    });
  }
  return result;
}
