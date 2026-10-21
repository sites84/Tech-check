/**
 * Fetch all rows from a Supabase/PostgREST endpoint in bounded pages.
 * PostgREST may cap individual responses, so callers must not rely on one
 * request returning every article or relationship row.
 */
export async function apiAll(baseUrl, headers, path, pageSize = 500) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) {
    throw new Error('pageSize deve ficar entre 1 e 1000.');
  }

  const cleanPath = path
    .replace(/([?&])limit=\d+/g, '')
    .replace(/\?&/g, '?')
    .replace(/[?&]$/g, '');
  const separator = cleanPath.includes('?') ? '&' : '?';
  const rows = [];
  let offset = 0;

  while (true) {
    const url = `${baseUrl}/rest/v1/${cleanPath}${separator}limit=${pageSize}&offset=${offset}`;
    const response = await fetch(url, { headers });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Supabase ${response.status} em offset ${offset}: ${body.slice(0, 400)}`);
    }

    const page = body ? JSON.parse(body) : [];
    if (!Array.isArray(page)) {
      throw new Error('Resposta Supabase inesperada durante paginação.');
    }
    rows.push(...page);
    offset += page.length;
    if (page.length < pageSize) break;
  }

  return rows;
}
