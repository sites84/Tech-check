import { writeFile } from 'node:fs/promises';
import { getDraftArticles, updateArticle, getCategoryByName, attachCategory, getPublishedArticles } from './supabase.mjs';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.1-flash-lite';
if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não está configurada nos secrets do GitHub.');

const categories=['Inteligência Artificial','Smartphones','Computadores','Games','Segurança','Ciência','Espaço','Gadgets','Internet','Cripto','Empresas','História da tecnologia','Curiosidades','Como funciona?'];

const responseSchema={
  type:'OBJECT',
  properties:{
    title:{type:'STRING'}, summary:{type:'STRING'}, content:{type:'STRING'},
    why_it_matters:{type:'STRING'}, future_outlook:{type:'STRING'}, category:{type:'STRING'},
    verification_level:{type:'STRING',enum:['single_source','official_source']}
  },
  required:['title','summary','content','why_it_matters','future_outlook','category','verification_level']
};

function parseJsonText(text){
  const cleaned=(text||'').trim();
  if(!cleaned) throw new Error('Gemini retornou uma resposta vazia.');
  try { return JSON.parse(cleaned); } catch {}
  const fenced=cleaned.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  try { return JSON.parse(fenced); } catch {}
  const start=fenced.indexOf('{');
  const end=fenced.lastIndexOf('}');
  if(start>=0 && end>start){
    try { return JSON.parse(fenced.slice(start,end+1)); } catch {}
  }
  throw new Error(`Resposta do Gemini não é JSON válido: ${cleaned.slice(0,500)}`);
}

function decodeEntities(value=''){
  return value.replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
}

function htmlToText(html=''){
  return decodeEntities(html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<noscript[\s\S]*?<\/noscript>/gi,' ').replace(/<svg[\s\S]*?<\/svg>/gi,' ').replace(/<(?:nav|header|footer|aside|form)[^>]*>[\s\S]*?<\/(?:nav|header|footer|aside|form)>/gi,' ').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(?:p|div|section|article|main|li|h[1-6]|blockquote)>/gi,'\n').replace(/<[^>]+>/g,' ')).split(/\n+/).map(line=>line.replace(/\s+/g,' ').trim()).filter(Boolean).join('\n');
}

async function fetchOriginalArticle(url){
  try{
    const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 Tech-Check/1.0 article reader'},signal:AbortSignal.timeout(12000)});
    if(!response.ok) throw new Error(`fonte ${response.status}`);
    const html=await response.text();
    const jsonLd=[...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for(const match of jsonLd){
      try{
        const raw=JSON.parse(match[1].trim());
        const nodes=Array.isArray(raw)?raw:[raw,...(raw?.['@graph']||[])];
        for(const node of nodes) if(typeof node?.articleBody==='string' && node.articleBody.length>500) return node.articleBody;
      }catch{}
    }
    const articleMatch=html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
    const text=htmlToText(articleMatch?.[1]||mainMatch?.[1]||html);
    return text.length>500 ? text : '';
  }catch(error){
    console.warn(`Não foi possível extrair o corpo de ${url}:`,error.message);
    return '';
  }
}

function targetLength(sourceText){
  const chars=sourceText.length;
  if(chars>=30000) return 'entre 1.800 e 2.500 palavras';
  if(chars>=15000) return 'entre 1.400 e 2.000 palavras';
  if(chars>=8000) return 'entre 1.000 e 1.600 palavras';
  if(chars>=3500) return 'entre 800 e 1.300 palavras';
  return 'entre 600 e 1.000 palavras';
}

async function generateOnce(article,model){
  const sourceText=await fetchOriginalArticle(article.original_url);
  const availableSource=sourceText || `O corpo completo da fonte não pôde ser recuperado automaticamente. Use somente os dados disponíveis abaixo e não invente informações.\n\nTítulo: ${article.title}\nResumo disponível: ${article.summary||'(não informado)'}`;
  const limitedSource=availableSource.slice(0,60000);
  const prompt=`Você é o editor do Tech Check, um portal brasileiro de tecnologia. Produza uma matéria jornalística completa em português brasileiro natural, clara e gostosa de ler, sem clickbait e sem copiar frases do texto original.

REGRA PRINCIPAL DE COMPLETUDE: o corpo da matéria deve cobrir TODAS as informações relevantes presentes na fonte fornecida. Não reduza uma matéria longa a um resumo curto. Preserve nomes, números, datas, especificações, acontecimentos, contexto, resultados, comparações, declarações e demais detalhes importantes que estejam no material. Se a fonte for longa, a matéria também deve ser longa e detalhada. A extensão desejada para esta fonte é ${targetLength(sourceText || article.summary || '')}.

FORMATAÇÃO OBRIGATÓRIA DO CAMPO content: escreva a matéria em Markdown simples para permitir uma apresentação editorial organizada no site. Use vários parágrafos curtos separados por uma linha em branco. Divida matérias longas em subtítulos usando linhas começando com ## . Quando houver listas naturais de produtos, recursos, especificações, etapas, características, vantagens, números ou itens comparáveis, use listas com - . Não transforme a matéria inteira em uma lista. Use subtítulos apenas quando ajudarem a leitura e nunca coloque tudo em um único parágrafo. Não use HTML. Não use # no título principal, pois o título será exibido separadamente pelo site.

Não invente fatos, declarações, fontes, datas, números ou capacidades técnicas. Se uma informação não estiver na fonte, não crie. Reescreva com suas próprias palavras e mantenha fidelidade ao conteúdo original. Não transforme uma lista ou conjunto de informações importantes em apenas uma descrição genérica.

O resumo deve ser curto e funcionar como introdução. O campo content é a matéria completa e deve ser muito mais detalhado que o resumo. Em why_it_matters, explique por que a notícia pode ser relevante usando somente informações sustentadas pela fonte. Em future_outlook, apresente possíveis extrapolações como cenários, usando 'pode', 'é possível' e 'se essa tendência continuar'; nunca apresente uma previsão como fato.

Categoria deve ser exatamente uma destas: ${categories.join(', ')}.
O nível de verificação deve ser single_source. Só use official_source se o material fornecido for claramente um comunicado ou anúncio oficial da organização citada. Nunca use multiple_sources nesta etapa.
Responda exclusivamente com o objeto JSON solicitado, sem markdown fora do campo content e sem texto antes ou depois.

URL da fonte: ${article.original_url}
Idioma original: ${article.original_language}
Título coletado: ${article.title}
Resumo/descrição coletada: ${article.summary||'(não informado)'}

CORPO RECUPERADO DA FONTE:\n${limitedSource}`;

  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':GEMINI_API_KEY},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.2,maxOutputTokens:8192,responseMimeType:'application/json',responseSchema,thinkingConfig:{thinkingLevel:'minimal'}}})});
  if(!response.ok){const error=new Error(`Gemini ${response.status}: ${await response.text()}`);error.status=response.status;throw error;}
  const data=await response.json();
  const candidate=data.candidates?.[0];
  const text=candidate?.content?.parts?.map(p=>p.text||'').join('').trim();
  if(!text) throw new Error(`Gemini não retornou texto (${candidate?.finishReason||'sem conteúdo'}).`);
  return parseJsonText(text);
}

async function generate(article){const models=[...new Set([GEMINI_MODEL,GEMINI_FALLBACK_MODEL])];let last=null;for(const model of models){for(let attempt=1;attempt<=4;attempt++){try{return await generateOnce(article,model);}catch(error){last=error;const retryable=[429,500,502,503,504].includes(error.status);if(!retryable||attempt===4)break;const delay=Math.min(15000,1500*(2**(attempt-1)));console.warn('Gemini '+model+' '+error.status+'; retry em '+delay+' ms');await new Promise(r=>setTimeout(r,delay));}}}throw last||new Error('Falha desconhecida no Gemini.');}
const newest=await getDraftArticles(30,'desc');
const oldest=await getDraftArticles(10,'asc');
const articles=[...new Map([...newest,...oldest].map(article=>[article.id,article])).values()];
const processed=[];

for(const article of articles){
  try{
    const result=await generate(article);
    if(!result.title || !result.summary || !result.content || !result.why_it_matters || !result.future_outlook || !result.category) throw new Error('Gemini retornou campos obrigatórios incompletos.');
    await updateArticle(article.id,{title:result.title,summary:result.summary,content:result.content,why_it_matters:result.why_it_matters,future_outlook:result.future_outlook,verification_level:result.verification_level,status:'review',published_at:article.published_at||article.created_at});
    const category=await getCategoryByName(result.category);
    if(category) await attachCategory(article.id,category.id);
    processed.push({id:article.id,title:result.title,category:result.category,status:'review',repaired:article.status==='review'});
  }catch(error){
    console.error(`Falha ao processar ${article.id}:`,error.message);
    processed.push({id:article.id,title:article.title,status:'error',error:error.message});
  }
}

await writeFile('data/ai-processing-report.json',JSON.stringify({updated_at:new Date().toISOString(),model:GEMINI_MODEL,processed},null,2));
const published=await getPublishedArticles(1000);
await writeFile('data/latest.json',JSON.stringify({updated_at:new Date().toISOString(),count:published.length,articles:published},null,2));
console.log(`Processadas ${processed.filter(item=>item.status==='review').length} notícias. ${processed.filter(item=>item.status==='error').length} ficaram para a próxima rodada. Feed público atualizado com ${published.length} matérias.`);