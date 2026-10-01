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

async function generate(article){
  const prompt=`Você é o editor do Tech Check, um portal brasileiro de tecnologia. Reescreva a notícia em português brasileiro natural, descontraído e gostoso de ler, sem piadas artificiais, sem clickbait e sem copiar frases do texto original. Preserve fatos, nomes e números fornecidos. Não invente fatos, declarações, fontes, datas ou capacidades técnicas. Diferencie fatos confirmados de interpretação.

A matéria precisa ter título, resumo curto e corpo com parágrafos curtos. Em why_it_matters, explique por que a notícia pode ser relevante. Em future_outlook, apresente possíveis extrapolações como cenários, usando 'pode', 'é possível' e 'se essa tendência continuar'; nunca apresente uma previsão como fato.

Categoria deve ser exatamente uma destas: ${categories.join(', ')}.

O nível de verificação deve ser single_source. Só use official_source se o material fornecido for claramente um comunicado ou anúncio oficial da organização citada. Nunca use multiple_sources nesta etapa.

Fonte: ${article.original_url}
Idioma original: ${article.original_language}
Título original: ${article.title}
Resumo/descrição disponível: ${article.summary||'(não informado)'}`;

  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,{
    method:'POST',
    headers:{'Content-Type':'application/json','x-goog-api-key':GEMINI_API_KEY},
    body:JSON.stringify({
      contents:[{parts:[{text:prompt}]}],
      generationConfig:{temperature:0.35,responseMimeType:'application/json',responseSchema}
    })
  });
  if(!response.ok) throw new Error(`Gemini ${response.status}: ${await response.text()}`);
  const data=await response.json();
  const text=data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();
  if(!text) throw new Error('A resposta do Gemini não contém texto.');
  return JSON.parse(text);
}

const articles=await getDraftArticles(8); const processed=[];
for(const article of articles){
  try{
    const result=await generate(article);
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
