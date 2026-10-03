import { mkdir, writeFile } from 'node:fs/promises';

const SOURCES = [
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'EMPRESAS' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'TECNOLOGIA' },
  { name: 'Engadget', url: 'https://www.engadget.com/rss.xml', category: 'GADGETS' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'TECNOLOGIA' }
];

function clean(value = '') {
  return value
    .replace(/<![CDATA[([\s\S]*?)]]>/gi, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ').trim();
}

function tag(xml, name) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? clean(match[1]) : '';
}

function attr(xml, name, attribute) {
  const match = xml.match(new RegExp(`<${name}[^>]*\\b${attribute}=["']([^"']+)["'][^>]*>`, 'i'));
  return match ? match[1].trim() : '';
}

function entries(xml) {
  return [...xml.matchAll(/<(?:item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/(?:item|entry)>/gi)].map(m => m[1]);
}

function linkValue(item) {
  return tag(item, 'link') || attr(item, 'link', 'href') || '';
}

function imageFromFeed(item) {
  return attr(item, 'media:content', 'url')
    || attr(item, 'media:thumbnail', 'url')
    || ((item.match(/<enclosure[^>]*\burl=["']([^"']+)["'][^>]*\btype=["']image\//i) || [])[1] || '')
    || ((item.match(/<img[^>]*\bsrc=["']([^"']+)["']/i) || [])[1] || '');
}

async function imageFromPage(url) {
  if (!url) return '';
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 Tech-Check-RSS/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return '';
    const html = await response.text();
    for (const pattern of [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
    ]) {
      const value = html.match(pattern)?.[1];
      if (value) return new URL(value, url).href;
    }
  } catch {}
  return '';
}

function publishedAt(item) {
  for (const name of ['pubDate', 'dc:date', 'published', 'updated', 'date']) {
    const value = tag(item, name);
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: {
      'User-Agent': 'Tech-Check-RSS/1.0',
      'Accept': 'application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8'
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const xml = await response.text();
  if (!/<(?:item|entry)\b/i.test(xml)) throw new Error('feed sem item/entry');

  const result = [];
  for (const item of entries(xml).slice(0, 12)) {
    const title = tag(item, 'title');
    const url = linkValue(item);
    if (!title || !url) continue;
    let image_url = imageFromFeed(item);
    if (!image_url) image_url = await imageFromPage(url);
    result.push({
      source: source.name,
      category: source.category,
      title,
      url,
      summary: tag(item, 'description') || tag(item, 'summary'),
      published_at: publishedAt(item),
      image_url
    });
  }
  return result;
}

const all = [];
for (const source of SOURCES) {
  try {
    all.push(...await fetchSource(source));
  } catch (error) {
    console.error(`Falha em ${source.name}:`, error.message);
  }
}

const unique = [...new Map(all.map(item => [item.url, item])).values()]
  .sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0))
  .slice(0, 40);

await mkdir('data', { recursive: true });
await writeFile('data/latest.json', JSON.stringify({
  updated_at: new Date().toISOString(),
  count: unique.length,
  articles: unique
}, null, 2));
console.log(`Coletadas ${unique.length} notícias.`);
