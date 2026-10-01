const demoNews = [{category:'TECNOLOGIA',title:'As primeiras matérias do Tech Check estão chegando',summary:'O portal já está conectado ao fluxo automático de coleta e processamento editorial.'}];

const grid = document.querySelector('#news-grid');
const status = document.querySelector('#status');
const emptyState = document.querySelector('#empty-state');
const searchButton = document.querySelector('#search-button');
const searchPanel = document.querySelector('#search-panel');
const searchInput = document.querySelector('#search-input');
const modal = document.querySelector('#article-modal');
const modalContent = document.querySelector('#modal-content');
let allNews = [];
let activeCategory = '';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[char]));
}

function formatDate(value) {
  if (!value) return 'Agora';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Agora';
  return new Intl.DateTimeFormat('pt-BR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(date);
}

function renderNews(items, live = false) {
  emptyState.hidden = items.length > 0;
  grid.innerHTML = items.map((item,index) => `
    <article class="news-card">
      ${item.image_url ? `<img class="card-image real-image" src="${escapeHtml(item.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<div class="card-image"><span>${escapeHtml(item.source || 'TECH CHECK')} · FONTE</span></div>`}
      <div class="card-body">
        <div class="card-meta"><span>${escapeHtml(item.category || 'TECNOLOGIA')}</span><span>${formatDate(item.published_at)}</span></div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.summary || 'Matéria em preparação.')}</p>
        <button class="read-button" type="button" data-read="${index}">Ler matéria</button>
      </div>
    </article>`).join('');
  if (status) status.textContent = live ? `${items.length} matérias publicadas · atualização automática` : 'Conteúdo de demonstração';
  grid.querySelectorAll('[data-read]').forEach(button => button.addEventListener('click', () => openArticle(items[Number(button.dataset.read)])));
}

function openArticle(article) {
  if (!article) return;
  const paragraphs = escapeHtml(article.content || '').split(/\n\s*\n/).filter(Boolean).map(p => `<p>${p.replace(/\n/g,' ')}</p>`).join('');
  modalContent.innerHTML = `
    <p class="eyebrow">${escapeHtml(article.category || 'TECNOLOGIA')} · ${formatDate(article.published_at)}</p>
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

function applyFilters(){
  const query = searchInput?.value.trim().toLowerCase() || '';
  const filtered = allNews.filter(item => {
    const categoryMatch = !activeCategory || item.category === activeCategory;
    const text = `${item.title || ''} ${item.summary || ''} ${item.content || ''}`.toLowerCase();
    return categoryMatch && (!query || text.includes(query));
  });
  renderNews(filtered, allNews.length > 0);
}

searchButton?.addEventListener('click', () => { searchPanel.hidden = !searchPanel.hidden; if(!searchPanel.hidden) searchInput.focus(); });
searchInput?.addEventListener('input', applyFilters);

document.querySelectorAll('#category-grid button').forEach(button => button.addEventListener('click', () => {
  const selected = button.dataset.category;
  activeCategory = activeCategory === selected ? '' : selected;
  document.querySelectorAll('#category-grid button').forEach(item => item.classList.toggle('selected', item === button && !!activeCategory));
  document.querySelector('#ultimas').scrollIntoView({behavior:'smooth'});
  applyFilters();
}));

renderNews(demoNews);

fetch('./data/latest.json', {cache:'no-store'})
  .then(response => { if(!response.ok) throw new Error('feed indisponível'); return response.json(); })
  .then(data => { if(Array.isArray(data.articles) && data.articles.length){ allNews = data.articles; renderNews(allNews,true); } })
  .catch(() => { allNews = demoNews; if(status) status.textContent = 'Aguardando a primeira atualização automática'; });
