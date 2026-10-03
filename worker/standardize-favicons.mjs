import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = 'noticias';

async function walk(dir) {
  const out = [];
  let entries = [];
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else if (entry.isFile() && entry.name === 'index.html') out.push(path);
  }
  return out;
}

function standardize(html) {
  const icons = '<link rel="icon" type="image/x-icon" href="../../favicon.ico"><link rel="icon" type="image/png" sizes="192x192" href="../../favicon.png"><link rel="apple-touch-icon" sizes="180x180" href="../../apple-touch-icon.png">';
  let out = html;
  out = out.replace(/<link[^>]+rel=["']icon["'][^>]*>\s*/gi, '');
  out = out.replace(/<link[^>]+rel=["']apple-touch-icon["'][^>]*>\s*/gi, '');
  if (/<meta[^>]+name=["']robots["'][^>]*>/i.test(out)) {
    out = out.replace(/(<meta[^>]+name=["']robots["'][^>]*>)/i, `$1${icons}`);
  } else {
    out = out.replace(/(<meta[^>]+name=["']description["'][^>]*>)/i, `$1${icons}`);
  }
  return out;
}

const files = await walk(ROOT);
let changed = 0;
for (const file of files) {
  const html = await readFile(file, 'utf8');
  const next = standardize(html);
  if (next !== html) {
    await writeFile(file, next);
    changed++;
  }
}
console.log(`Favicons padronizados: ${changed} páginas.`);
