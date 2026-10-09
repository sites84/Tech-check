import { writeFile, mkdir } from 'node:fs/promises';
import { getPublishedArticles } from './supabase.mjs';

let articles = [];
try {
  articles = await getPublishedArticles(1000);
} catch (error) {
  console.error('Falha ao consultar o feed publicado no Supabase:', error?.message || error);
  // Preserve the last valid fallback instead of failing the entire workflow.
  const { access } = await import('node:fs/promises');
  try {
    await access('data/latest.json');
    console.warn('Mantendo data/latest.json existente; nenhuma substituição foi feita.');
    process.exit(0);
  } catch {
    throw error;
  }
}
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
