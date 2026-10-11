import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// A função de mídia original foi desativada. Remove blocos já gravados nas páginas.
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else if (entry.isFile() && entry.name === 'index.html') out.push(path);
  }
  return out;
}

const files = await walk('noticias').catch(() => []);
let changed = 0;
for (const file of files) {
  const original = await readFile(file, 'utf8');
  const cleaned = original.replace(/<section\\b[^>]*class=["'][^"']*\\boriginal-media\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/section>/gi, '');
  if (cleaned !== original) {
    await writeFile(file, cleaned);
    changed++;
  }
}
console.log(`Mídia original desativada: blocos removidos=${changed}.`);
