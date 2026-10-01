import { writeFile } from 'node:fs/promises';
import { getDraftArticles, updateArticle, getCategoryByName, attachCategory } from './supabase.mjs';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
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

async function generate(article){
  const prompt=`Você é o editor do Tech Check, um portal brasileiro de tecnologia. Reescreva a notícia em português brasileiro natural, descontraído e gostoso de ler, sem piadas artificiais, sem clickbait e sem copiar frases do texto original. Preserve fatos, nomes e números fornecidos. Não invente fatos, declarações, fontes, datas ou capacidades técnicas. Diferencie fatos confirmados de interpretação.

A matéria precisa ter título, resumo curto e corpo com parágrafos curtos. Em why_it_matters, explique por que a notícia pode ser relevante. Em future_outlook, apresente possíveis extrapolações como cenários, usando 'pode', 'é possível' e 'se essa tendência continuar'; nunca apresente uma previsão como fato.

Categoria deve ser exatamente uma destas: ${categories.join(', ')}.

O nível de verificação deve ser single_source. Só use official_source se o material fornecido for claramente um comunicado ou anúncio oficial da organização citada. Nunca use multiple_sources nesta etapa.

Responda exclusivamente com o objeto JSON solicitado, sem markdown e sem texto antes ou depois.

Fonte: ${article.original_url}
Idioma original: ${article.original_language}
Título original: ${article.title}
Resumo/descrição disponível: ${article.summary||'(não informado)'}`;

  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,{
    method:'POST',
    headers:{'Content-Type':'application/json','x-goog-api-key':GEMINI_API_KEY},
    body:JSON.stringify({
      contents:[{parts:[{text:prompt}]}],
      generationConfig:{
        temperature:0.2,
        maxOutputTokens:4096,
        responseMimeType:'application/json',
        responseSchema,
        thinkingConfig:{thinkingLevel:'minimal'}
      }
    })
  });
  if(!response.ok) throw new Error(`Gemini ${response.status}: ${await response.text()}`);
  const data=await response.json();
  const candidate=data.candidates?.[0];
  const text=candidate?.content?.parts?.map(p=>p.text||'').join('').trim();
  if(!text){
    const reason=candidate?.finishReason || 'sem conteúdo';
    throw new Error(`Gemini não retornou texto (${reason}).`);
  }
  return parseJsonText(text);
}

const articles=await getDraftArticles(8); const processed=[];
for(const article of articles){
  try{
    const result=await generate(article);
    if(!result.title || !result.summary || !result.content || !result.why_it_matters || !result.future_outlook || !result.category){
      throw new Error('Gemini retornou campos obrigatórios incompletos.');
    }
    await updateArticle(article.id,{title:result.title,summary:result.summary,content:result.content,why_it_matters:result.why_it_matters,future_outlook:result.future_outlook,verification_level:result.verification_level,status:'review'});
    const category=await getCategoryByName(result.category);
    if(category) await attachCategory(article.id,category.id);
    processed.push({id:article.id,title:result.title,category:result.category,status:'review'});
  }catch(error){
    console.error(`Falha ao processar ${article.id}:`,error.message);
    processed.push({id:article.id,title:article.title,status:'error',error:error.message});
  }
}
await writeFile('data/ai-processing-report.json',JSON.stringify({updated_at:new Date().toISOString(),model:GEMINI_MODEL,processed},null,2));
const failures=processed.filter(item=>item.status==='error');
console.log(`Processadas ${processed.filter(item=>item.status==='review').length} notícias.`);
if(failures.length) throw new Error(`${failures.length} notícia(s) falharam no processamento. Veja data/ai-processing-report.json.`);
