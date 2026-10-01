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

function attrTag(xml, name, attribute) {
  const match = xml.match(new RegExp(`<${name}[^>]*\\b${attribute}=["']([^"']+)["'][^>]*>`, 'i'));
  return match ? match[1].trim() : '';
}

function items(xml) {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(m => m[1]);
}

function firstImageFromRss(item) {
  // Media RSS: imagem principal/thumbnail
  const mediaContent = attrTag(item, 'media:content', 'url');
  if (mediaContent && /\.(jpe?g|png|webp|gif)(?:[?#].*)?$/i.test(mediaContent)) return mediaContent;

  const mediaThumbnail = attrTag(item, 'media:thumbnail', 'url');
  if (mediaThumbnail) return mediaThumbnail;

  // RSS enclosure pode conter uma imagem
  const enclosureMatch = item.match(/<enclosure[^>]*\burl=["']([^"']+)["'][^>]*\btype=["']image\/(?:jpeg|jpg|png|webp|gif)["'][^>]*>/i);
  if (enclosureMatch) return enclosureMatch[1].trim();

  // Alguns feeds colocam a imagem no HTML da description/content
  const html = item.match(/<(?:content:encoded|description)[^>]*>([\s\S]*?)<\/(?:content:encoded|description)>/i)?.[1] || '';
  const img = html.match(/<img[^>]*\bsrc=["']([^"']+)["']/i);
  return img ? img[1].trim() : '';
}

async function imageFromArticlePage(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Tech-Check/1.0 image metadata collector' },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return '';
    const html = await response.text();

    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return new URL(match[1], url).href;
    }
  } catch {
    // A ausência da imagem não impede a coleta da notícia.
  }
  return '';
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

      let image_url = firstImageFromRss(item);
      if (!image_url) image_url = await imageFromArticlePage(url);

      const article = await insertArticle({
        title,
        url,
        summary: tag(item, 'description'),
        language: source.language,
        image_url
      });

      await attachSource(article.id, source.id, title, url);
      collected.push({ id: article.id, title, source: source.name, image_url: image_url || null });
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
