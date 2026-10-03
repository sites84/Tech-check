import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT='noticias';
async function walk(dir){
  const out=[];
  for(const e of await readdir(dir,{withFileTypes:true})){
    const p=join(dir,e.name);
    if(e.isDirectory()) out.push(...await walk(p));
    else if(e.isFile()&&e.name==='index.html') out.push(p);
  }
  return out;
}

const script='<script src="../../article-dark-mode.js?v=1"></script>';
const files=await walk(ROOT).catch(()=>[]);
let changed=0;
for(const file of files){
  let html=await readFile(file,'utf8');
  if(html.includes('article-dark-mode.js')) continue;
  if(!html.includes('</body>')) continue;
  html=html.replace('</body>',`${script}</body>`);
  await writeFile(file,html);
  changed++;
}
console.log(`Modo escuro das matérias: ${changed} páginas atualizadas.`);
