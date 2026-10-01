const demoNews = [
  {category:'INTELIGÊNCIA ARTIFICIAL',time:'MVP',title:'O Tech Check está preparando o primeiro fluxo automático de notícias',text:'A página já está preparada para receber notícias coletadas de fontes especializadas. O próximo estágio adicionará tradução, verificação, redação e análise de possíveis desdobramentos.'},
  {category:'TECNOLOGIA',time:'MVP',title:'Notícias de tecnologia do mundo em um só lugar',text:'O portal vai reunir acontecimentos relevantes, comparar fontes quando possível e apresentar tudo em português, com linguagem natural.'},
  {category:'CURIOSIDADES',time:'MVP',title:'Curiosidades e história também farão parte do arquivo',text:'Além das notícias do dia, o Tech Check terá conteúdo permanente sobre a evolução da tecnologia e como as coisas funcionam.'}
];

const grid = document.querySelector('#news-grid');
const status = document.querySelector('#status');

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[char]));
}

function formatDate(value) {
  if (!value) return 'Agora';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Agora';
  return new Intl.DateTimeFormat('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }).format(date);
}

function renderNews(items, live = false) {
  grid.innerHTML = items.map(item => `
    <article class="news-card">
      <div class="card-image">${escapeHtml(item.source || 'TECH CHECK')} · FONTE</div>
      <div class="card-body">
        <div class="card-meta"><span>${escapeHtml(item.category || 'TECNOLOGIA')}</span><span>${formatDate(item.published_at)}</span></div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.summary || 'Matéria em preparação para o processamento editorial.')}</p>
      </div>
    </article>
  `).join('');
  if (status) status.textContent = live ? 'RSS · notícias coletadas automaticamente' : 'MVP · aguardando primeira coleta';
}

renderNews(demoNews);

fetch('./data/latest.json', { cache: 'no-store' })
  .then(response => {
    if (!response.ok) throw new Error('feed indisponível');
    return response.json();
  })
  .then(data => {
    if (Array.isArray(data.articles) && data.articles.length) renderNews(data.articles, true);
  })
  .catch(() => {});
