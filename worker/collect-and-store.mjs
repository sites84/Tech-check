import { writeFile } from 'node:fs/promises';
import { getSources, findArticleByUrl, findArticleByTitle, insertArticle, updateArticleImage, attachSource } from './supabase.mjs';

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

function normalizeUrl(value='') {
  try {
    const u = new URL(value.trim());
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|ref$|source$)/i.test(key)) u.searchParams.delete(key);
    }
    u.hostname = u.hostname.toLowerCase().replace(/^www\./,'');
    u.pathname = u.pathname.replace(/\/+$/,'') || '/';
    return u.toString();
  } catch {
    return value.trim().replace(/[?#].*$/,'').replace(/\/$/,'');
  }
}

function normalizeTitle(value='') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function firstImageFromRss(item) {
  const mediaContent = attrTag(item, 'media:content', 'url');
  if (mediaContent) return mediaContent;

  const mediaThumbnail = attrTag(item, 'media:thumbnail', 'url');
  if (mediaThumbnail) return mediaThumbnail;

  const enclosureMatch = item.match(/<enclosure[^>]*\burl=["']([^"']+)["'][^>]*\btype=["']image\/(?:jpeg|jpg|png|webp|gif)["'][^>]*>/i);
  if (enclosureMatch) return enclosureMatch[1].trim();

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
const imagesUpdated = [];
const duplicatesSkipped = [];
const seenUrls = new Set();
const seenTitles = new Set();

for (const source of sources) {
  try {
    const response = await fetch(source.feed_url, {
      headers: { 'User-Agent': 'Tech-Check/1.0 RSS collector' }
    });
    if (!response.ok) throw new Error(`${response.status}`);

    const xml = await response.text();

    for (const item of items(xml).slice(0, 15)) {
      const title = tag(item, 'title');
      const rawUrl = tag(item, 'link');
      if (!title || !rawUrl) continue;

      const url = normalizeUrl(rawUrl);
      const titleKey = normalizeTitle(title);
      if (!url || !titleKey) continue;

      if (seenUrls.has(url) || seenTitles.has(titleKey)) {
        duplicatesSkipped.push({ title, url, source: source.name, reason: 'duplicado no lote atual' });
        continue;
      }

      let image_url = firstImageFromRss(item);
      if (!image_url) image_url = await imageFromArticlePage(rawUrl);

      const existingByUrl = await findArticleByUrl(url);
      const existingByTitle = existingByUrl || await findArticleByTitle(title);
      if (existingByTitle) {
        seenUrls.add(url);
        seenTitles.add(titleKey);
        if (!existingByTitle.image_url && image_url) {
          await updateArticleImage(existingByTitle.id, image_url);
          imagesUpdated.push({ id: existingByTitle.id, title, source: source.name, image_url });
        }
        duplicatesSkipped.push({ title, url, source: source.name, reason: 'já cadastrado' });
        continue;
      }

      const article = await insertArticle({
        title,
        url,
        summary: tag(item, 'description'),
        language: source.language,
        image_url
      });

      await attachSource(article.id, source.id, title, url);
      seenUrls.add(url);
      seenTitles.add(titleKey);
      collected.push({ id: article.id, title, source: source.name, image_url: image_url || null });
    }
  } catch (error) {
    console.error(`Falha em ${source.name}:`, error.message);
  }
}

await writeFile(
  'data/collection-report.json',
  JSON.stringify({ updated_at: new Date().toISOString(), inserted: collected, images_updated: imagesUpdated, duplicates_skipped: duplicatesSkipped }, null, 2)
);

console.log(`Novas notícias inseridas no Supabase: ${collected.length}`);
console.log(`Imagens preenchidas em notícias existentes: ${imagesUpdated.length}`);
console.log(`Duplicadas ignoradas: ${duplicatesSkipped.length}`);
