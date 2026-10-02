import { mkdir, readFile, writeFile } from 'node:fs/promises';

const SOURCES = [
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'EMPRESAS' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'TECNOLOGIA' },
  { name: 'Engadget', url: 'https://www.engadget.com/rss.xml', category: 'GADGETS' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'TECNOLOGIA' }
];

function clean(value = '') {
  return value.replace(/<![CDATA[([\s\S]*?)]]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}

function tag(xml, name) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? clean(match[1]) : '';
}

function items(xml) {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(m => m[1]);
}

async function fetchSource(source) {
  const response = await fetch(source.url, { headers: { 'User-Agent': 'Tech-Check-RSS/1.0' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const xml = await response.text();
  return items(xml).slice(0, 12).map(item => ({
    source: source.name,
    category: source.category,
    title: tag(item, 'title'),
    url: tag(item, 'link'),
    summary: tag(item, 'description'),
    published_at: tag(item, 'pubDate') || tag(item, 'published')
  })).filter(item => item.title && item.url);
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
await writeFile('data/latest.json', JSON.stringify({ updated_at: new Date().toISOString(), count: unique.length, articles: unique }, null, 2));
console.log(`Coletadas ${unique.length} notícias.`);
