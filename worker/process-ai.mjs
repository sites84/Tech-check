import { writeFile } from 'node:fs/promises';
import { getDraftArticles, updateArticle } from './supabase.mjs';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6';

if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY não está configurada nos secrets do GitHub.');

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    content: { type: 'string' },
    why_it_matters: { type: 'string' },
    future_outlook: { type: 'string' },
    category: { type: 'string' },
    verification_level: { type: 'string', enum: ['single_source', 'multiple_sources', 'official_source'] }
  },
  required: ['title','summary','content','why_it_matters','future_outlook','category','verification_level']
};

const categories = ['Inteligência Artificial','Smartphones','Computadores','Games','Segurança','Ciência','Espaço','Gadgets','Internet','Cripto','Empresas','História da tecnologia','Curiosidades','Como funciona?'];

function extractText(response) {
  if (response.output_text) return response.output_text;
  for (const item of response.output || []) {
    if (item.type === 'message') {
      for (const part of item.content || []) if (part.type === 'output_text' && part.text) return part.text;
    }
  }
  throw new Error('A resposta da IA não contém texto.');
}

async function generate(article) {
  const instructions = `Você é o editor do Tech Check, um portal brasileiro de tecnologia. Reescreva a notícia em português brasileiro natural, descontraído e gostoso de ler, sem piadas artificiais, sem clickbait e sem copiar frases do texto original. Preserve os fatos e números fornecidos. Não invente fatos, declarações, fontes, datas ou capacidades técnicas. Diferencie claramente fatos confirmados de interpretação.

A matéria precisa ter título, resumo curto e corpo com parágrafos curtos. Em 'why_it_matters', explique por que a notícia pode ser relevante para pessoas ou para o mercado. Em 'future_outlook', faça possíveis extrapolações de futuro apenas como cenários: use linguagem como 'pode', 'é possível' e 'se essa tendência continuar'; nunca apresente previsão como fato.

Categoria deve ser exatamente uma destas: ${categories.join(', ')}.

O nível de verificação deve ser 'single_source' porque este primeiro processamento recebeu uma única fonte. Só use 'official_source' se o próprio conteúdo indicar claramente que se trata de um comunicado ou anúncio oficial da organização citada. Não eleve para multiple_sources sem evidência de outra fonte.`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      instructions,
      input: `Fonte: ${article.original_url}\nIdioma original: ${article.original_language}\nTítulo original: ${article.title}\nResumo/descrição disponível: ${article.summary || '(não informado)'}`,
      temperature: 0.35,
      text: { format: { type: 'json_schema', name: 'tech_check_article', strict: true, schema } }
    })
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  return JSON.parse(extractText(await response.json()));
}

const articles = await getDraftArticles(8);
const processed = [];

for (const article of articles) {
  try {
    const result = await generate(article);
    await updateArticle(article.id, {
      title: result.title,
      summary: result.summary,
      content: result.content,
      why_it_matters: result.why_it_matters,
      future_outlook: result.future_outlook,
      verification_level: result.verification_level,
      status: 'review'
    });
    processed.push({ id: article.id, title: result.title, category: result.category, status: 'review' });
  } catch (error) {
    console.error(`Falha ao processar ${article.id}:`, error.message);
    processed.push({ id: article.id, title: article.title, status: 'error', error: error.message });
  }
}

await writeFile('data/ai-processing-report.json', JSON.stringify({ updated_at: new Date().toISOString(), processed }, null, 2));
console.log(`Processadas ${processed.filter(item => item.status === 'review').length} notícias.`);
