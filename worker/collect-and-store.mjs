import { writeFile } from 'node:fs/promises';
import { getSources, findArticleByUrl, insertArticle, attachSource } from './supabase.mjs';

function clean(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(xml, name) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? clean(match[1]) : '';
}

function items(xml) {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(m => m[1]);
}

const sources = await getSources();
const collected = [];

for (const source of sources) {
  try {
    const response = await fetch(source.feed_url, {
      headers: { 'User-Agent': 'Tech-Check/1.0 RSS collector' }
    });
    if (!response.ok) throw new Error(`${response.status}`);

    const xml = await response.text();

    for (const item of items(xml).slice(0, 15)) {
      const title = tag(item, 'title');
      const url = tag(item, 'link');
      if (!title || !url) continue;
      if (await findArticleByUrl(url)) continue;

      const article = await insertArticle({
        title,
        url,
        summary: tag(item, 'description'),
        language: source.language
      });

      await attachSource(article.id, source.id, title, url);
      collected.push({ id: article.id, title, source: source.name });
    }
  } catch (error) {
    console.error(`Falha em ${source.name}:`, error.message);
  }
}

await writeFile(
  'data/collection-report.json',
  JSON.stringify({ updated_at: new Date().toISOString(), inserted: collected }, null, 2)
);

console.log(`Novas notícias inseridas no Supabase: ${collected.length}`);
