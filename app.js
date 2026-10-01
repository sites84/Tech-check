const SUPABASE_URL = 'https://ymiqcnzulxbshjrnaujv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-rbhLGxEgLXlfMZ64W7ypw_xyy3aLjR';
const demoNews = [{category:'TECNOLOGIA',title:'As primeiras matérias do Tech Check estão chegando',summary:'O portal já está conectado ao fluxo automático de coleta e processamento editorial.'}];

const grid = document.querySelector('#news-grid');
const status = document.querySelector('#status');
const emptyState = document.querySelector('#empty-state');
const searchButton = document.querySelector('#search-button');
const searchPanel = document.querySelector('#search-panel');
const searchInput = document.querySelector('#search-input');
const modal = document.querySelector('#article-modal');
const modalContent = document.querySelector('#modal-content');
const showMoreButton = document.querySelector('#show-more-button');
let allNews = [];
let activeCategory = '';
let visibleLimit = 5;
const PAGE_SIZE = 5;

const apiHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[char]));
}

function formatDate(value) {
  if (!value) return 'Agora';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Agora';
  return new Intl.DateTimeFormat('pt-BR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(date);
}

function getFilteredNews() {
  const query = searchInput?.value.trim().toLowerCase() || '';
  return allNews.filter(item => {
    const categoryMatch = !activeCategory || item.category === activeCategory;
    const text = `${item.title || ''} ${item.summary || ''} ${item.content || ''}`.toLowerCase();
    return categoryMatch && (!query || text.includes(query));
  });
}

function renderNews(items, live = false) {
  const visibleItems = items.slice(0, visibleLimit);
  emptyState.hidden = items.length > 0;
  grid.innerHTML = visibleItems.map((item,index) => `
    <article class="news-card">
      ${item.image_url ? `<img class="card-image real-image" src="${escapeHtml(item.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<div class="card-image"><span>${escapeHtml(item.source || 'TECH CHECK')} · FONTE</span></div>`}
      <div class="card-body">
        <div class="card-meta"><span>${escapeHtml(item.category || 'TECNOLOGIA')}</span><span>${formatDate(item.published_at || item.created_at)}</span></div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.summary || 'Matéria em preparação.')}</p>
        <button class="read-button" type="button" data-read="${index}">Ler matéria</button>
      </div>
    </article>`).join('');

  if (status) status.textContent = live ? `${items.length} matérias publicadas · banco atualizado automaticamente` : 'Conteúdo de demonstração';

  grid.querySelectorAll('[data-read]').forEach(button => button.addEventListener('click', () => openArticle(visibleItems[Number(button.dataset.read)])));

  if (showMoreButton) {
    const remaining = Math.max(0, items.length - visibleLimit);
    showMoreButton.hidden = remaining === 0;
    showMoreButton.textContent = remaining > 0 ? `Mostrar mais (${remaining})` : 'Mostrar mais';
  }
}

function updateCategoryCounts() {
  const counts = new Map();
  allNews.forEach(article => {
    if (article.category) counts.set(article.category, (counts.get(article.category) || 0) + 1);
  });
  document.querySelectorAll('#category-grid button').forEach(button => {
    const category = button.dataset.category;
    const count = counts.get(category) || 0;
    let countElement = button.querySelector('.category-count');
    if (!countElement) {
      countElement = document.createElement('span');
      countElement.className = 'category-count';
      button.appendChild(countElement);
    }
    countElement.textContent = count;
  });
}

function openArticle(article) {
  if (!article) return;
  const paragraphs = escapeHtml(article.content || '').split(/\n\s*\n/).filter(Boolean).map(p => `<p>${p.replace(/\n/g,' ')}</p>`).join('');
  const image = article.image_url ? `<img class="modal-hero-image" src="${escapeHtml(article.image_url)}" alt="${escapeHtml(article.title || '')}" loading="eager" referrerpolicy="no-referrer">` : '';
  modalContent.innerHTML = `
    ${image}
    <p class="eyebrow">${escapeHtml(article.category || 'TECNOLOGIA')} · ${formatDate(article.published_at || article.created_at)}</p>
    <h2 id="modal-title">${escapeHtml(article.title)}</h2>
    <p class="modal-summary">${escapeHtml(article.summary || '')}</p>
    <div class="article-body">${paragraphs || '<p>Conteúdo ainda não disponível.</p>'}</div>
    ${article.why_it_matters ? `<section class="analysis-box"><p class="eyebrow">POR QUE ISSO IMPORTA</p><p>${escapeHtml(article.why_it_matters)}</p></section>` : ''}
    ${article.future_outlook ? `<section class="future-box"><p class="eyebrow">O QUE PODE ACONTECER NO FUTURO</p><p>${escapeHtml(article.future_outlook)}</p><small>São cenários possíveis, não previsões garantidas.</small></section>` : ''}
    <div class="source-box"><strong>Fonte da matéria</strong><span>${escapeHtml(article.source || 'Fonte original')}</span><a href="${escapeHtml(article.source_url || article.original_url || '#')}" target="_blank" rel="noopener noreferrer">Ler fonte original ↗</a></div>`;
  modal.hidden = false;
  document.body.classList.add('modal-open');
}

function closeModal(){ modal.hidden = true; document.body.classList.remove('modal-open'); }
document.querySelectorAll('[data-close-modal]').forEach(element => element.addEventListener('click', closeModal));
document.addEventListener('keydown', event => { if(event.key === 'Escape' && !modal.hidden) closeModal(); });

function applyFilters(resetLimit = true){
  if (resetLimit) visibleLimit = PAGE_SIZE;
  renderNews(getFilteredNews(), allNews.length > 0);
}

searchButton?.addEventListener('click', () => { searchPanel.hidden = !searchPanel.hidden; if(!searchPanel.hidden) searchInput.focus(); });
searchInput?.addEventListener('input', () => applyFilters(true));
showMoreButton?.addEventListener('click', () => {
  visibleLimit += PAGE_SIZE;
  renderNews(getFilteredNews(), allNews.length > 0);
  showMoreButton?.scrollIntoView({behavior:'smooth', block:'center'});
});

document.querySelectorAll('#category-grid button').forEach(button => button.addEventListener('click', () => {
  const selected = button.dataset.category;
  activeCategory = activeCategory === selected ? '' : selected;
  document.querySelectorAll('#category-grid button').forEach(item => item.classList.toggle('selected', item === button && !!activeCategory));
  applyFilters(true);
  document.querySelector('#ultimas').scrollIntoView({behavior:'smooth'});
}));

async function loadNewsFromSupabase() {
  const articleUrl = `${SUPABASE_URL}/rest/v1/articles?status=eq.review&select=id,title,slug,summary,content,why_it_matters,future_outlook,image_url,original_url,verification_level,published_at,created_at&order=published_at.desc.nullslast,created_at.desc&limit=100`;
  const [articleResponse, categoryResponse, linkResponse, sourceResponse] = await Promise.all([
    fetch(articleUrl, {headers: apiHeaders}),
    fetch(`${SUPABASE_URL}/rest/v1/categories?select=id,name`, {headers: apiHeaders}),
    fetch(`${SUPABASE_URL}/rest/v1/article_categories?select=article_id,category_id`, {headers: apiHeaders}),
    fetch(`${SUPABASE_URL}/rest/v1/article_sources?select=article_id,source_title,source_url`, {headers: apiHeaders})
  ]);
  if (!articleResponse.ok) throw new Error(`articles ${articleResponse.status}`);
  const [articles,categories,categoryLinks,sources] = await Promise.all([
    articleResponse.json(),
    categoryResponse.ok ? categoryResponse.json() : [],
    linkResponse.ok ? linkResponse.json() : [],
    sourceResponse.ok ? sourceResponse.json() : []
  ]);
  const categoryMap = new Map(categories.map(item => [item.id,item.name]));
  const categoryByArticle = new Map(categoryLinks.map(item => [item.article_id,categoryMap.get(item.category_id) || 'Tecnologia']));
  const sourceByArticle = new Map(sources.map(item => [item.article_id,{title:item.source_title,url:item.source_url}]));
  return articles.map(article => ({
    ...article,
    category: categoryByArticle.get(article.id) || 'Tecnologia',
    source: sourceByArticle.get(article.id)?.title || 'Fonte original',
    source_url: sourceByArticle.get(article.id)?.url || article.original_url
  }));
}

renderNews(demoNews);
loadNewsFromSupabase()
  .then(articles => {
    allNews = articles;
    updateCategoryCounts();
    if (articles.length) {
      renderNews(allNews, true);
    } else {
      renderNews([], true);
      if(status) status.textContent = 'Nenhuma matéria publicada no momento';
    }
  })
  .catch(error => {
    console.error('Tech Check:', error);
    fetch('./data/latest.json', {cache:'no-store'})
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => {
        if(Array.isArray(data.articles) && data.articles.length){
          allNews=data.articles;
          updateCategoryCounts();
          renderNews(allNews,true);
        }
      })
      .catch(() => {
        allNews=demoNews;
        updateCategoryCounts();
        renderNews(allNews,false);
        if(status) status.textContent='Aguardando atualização automática';
      });
  });
