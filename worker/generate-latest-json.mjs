import { writeFile, mkdir } from 'node:fs/promises';
import { getPublishedArticles } from './supabase.mjs';

const articles = await getPublishedArticles(1000);
await mkdir('data', { recursive: true });
await writeFile(
  'data/latest.json',
  JSON.stringify({
    updated_at: new Date().toISOString(),
    count: articles.length,
    articles
  }, null, 2)
);
console.log(`Fallback atualizado: ${articles.length} matérias publicadas.`);
