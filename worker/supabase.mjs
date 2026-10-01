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
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

export async function getSources() {
  return request('sources?active=eq.true&select=*');
}

export async function findArticleByUrl(url) {
  const rows = await request(`articles?original_url=eq.${encodeURIComponent(url)}&select=id&limit=1`);
  return rows[0] || null;
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
      status: 'draft',
      verification_level: 'single_source'
    })
  });
  return rows[0];
}
