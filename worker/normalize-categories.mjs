const base=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!base||!key)throw new Error('Supabase secrets ausentes.');
const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
async function api(path,options={}){const r=await fetch(`${base}/rest/v1/${path}`,{...options,headers:{...headers,...(options.headers||{})}});const text=await r.text();if(!r.ok)throw Error(`${r.status}: ${text.slice(0,300)}`);return text?JSON.parse(text):null;}
async function getCategories(){const rows=await api('categories?select=id,name');return new Map(rows.map(x=>[x.name,x.id]));}
function norm(v=''){return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function pickCategory(title,sourceNames,existing,cats){
 const t=norm(title), sources=sourceNames.map(norm).join(' ');
 const game=/(game|jogo|rpg|racer|corrida|playstation|xbox|nintendo|steam|console|fliperama|videogame|gameplay|naughty dog|ps5|ps4|switch)/.test(t);
 if(game&&cats.has('Games'))return cats.get('Games');
 if(/(screenrant|collider|entertainment weekly|variety|animation magazine)/.test(sources)&&cats.has('Filmes, Séries e Animações'))return cats.get('Filmes, Séries e Animações');
 if(/(android authority|9to5google|9to5mac|gsmarena|macworld|engadget)/.test(sources)&&/(galaxy|iphone|pixel|android|ipad|tablet|smartphone|celular|watch|fone|earbuds|airpods)/.test(t)&&cats.has('Smartphones'))return cats.get('Smartphones');
 if(/(bleepingcomputer|the hacker news|darkreading)/.test(sources)&&cats.has('Segurança'))return cats.get('Segurança');
 if(/(nasa|space\.com|astronomy)/.test(sources)&&cats.has('Ciência'))return cats.get('Ciência');
 if(/(openai|anthropic|hugging face)/.test(sources)&&cats.has('Inteligência Artificial'))return cats.get('Inteligência Artificial');
 if(/(tom's hardware|tomshardware|pcworld|computerworld)/.test(sources)&&cats.has('Computadores'))return cats.get('Computadores');
 if(/(techcrunch|venturebeat|business insider)/.test(sources)&&/(empresa|empresa|ceo|executivo|acordo|receita|investimento|milhões|bilhões|salario|salário|mercado|negocio|negócio|assina|assinatura|serviço|servicos|serviços|preço|preços|governador|lei)/.test(t)&&cats.has('Empresas'))return cats.get('Empresas');
 if(/(pandora|doordash)/.test(t)&&cats.has('Empresas'))return cats.get('Empresas');
 if(/(ars technica)/.test(sources)&&/(sarampo|cdc|saude|saúde|medicina|cient|espaco|espaço|nasa|astronomia)/.test(t)&&cats.has('Ciência'))return cats.get('Ciência');
 if(/(ars technica)/.test(sources)&&/(playstation|emula|game|jogo)/.test(t)&&cats.has('Games'))return cats.get('Games');
 if(/(engadget)/.test(sources)&&/(tablet|galaxy|iphone|pixel|android|smartphone|celular)/.test(t)&&cats.has('Smartphones'))return cats.get('Smartphones');
 if(existing.length===1&&existing[0]&&cats.has(existing[0]))return cats.get(existing[0]);
 return null;
}
const cats=await getCategories();
const articles=await api('articles?status=in.(draft,review)&select=id,title,original_url&limit=2000');
const links=await api('article_categories?select=article_id,category_id');
const sourceLinks=await api('article_sources?select=article_id,source_id');
const sources=await api('sources?select=id,name');
const sourceMap=new Map(sources.map(x=>[x.id,x.name]));
const byArticle=new Map();for(const l of links){if(!byArticle.has(l.article_id))byArticle.set(l.article_id,[]);byArticle.get(l.article_id).push(l.category_id);}
const sourceByArticle=new Map();for(const l of sourceLinks){if(!sourceByArticle.has(l.article_id))sourceByArticle.set(l.article_id,[]);sourceByArticle.get(l.article_id).push(sourceMap.get(l.source_id)||'');}
const valid=new Set(['Inteligência Artificial','Games','Filmes, Séries e Animações','Smartphones','Computadores','Ciência','Segurança','Internet','Empresas']);
const categoryNameById=new Map([...cats].map(([name,id])=>[id,name]));
const fixed=[];const unresolved=[];
for(const a of articles){
 const existing=(byArticle.get(a.id)||[]).map(id=>categoryNameById.get(id)).filter(Boolean);
 const validExisting=existing.filter(x=>valid.has(x));
 const desired=pickCategory(a.title,sourceByArticle.get(a.id)||[],validExisting,cats);
 if(!desired){if(existing.length===1&&valid.has(existing[0]))continue;unresolved.push({id:a.id,title:a.title,existing,sources:sourceByArticle.get(a.id)||[]});continue;}
 const currentIds=byArticle.get(a.id)||[];
 if(currentIds.length===1&&currentIds[0]===desired)continue;
 await api(`article_categories?article_id=eq.${encodeURIComponent(a.id)}`,{method:'DELETE'});
 await api('article_categories',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates'},body:JSON.stringify({article_id:a.id,category_id:desired})});
 fixed.push({id:a.id,title:a.title,from:existing,to:categoryNameById.get(desired)});
}
await import('node:fs/promises').then(fs=>fs.writeFile('data/category-normalization-report.json',JSON.stringify({updated_at:new Date().toISOString(),fixed,unresolved},null,2)));
console.log(`Categorias corrigidas: ${fixed.length}. Sem classificação automática: ${unresolved.length}.`);