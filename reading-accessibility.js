(() => {
  function addReadingUI() {
    const article = document.querySelector('.modal-card');
    if (!article || article.querySelector('.reading-progress')) return;
    const bar = document.createElement('div');
    bar.className = 'reading-progress';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<span></span>';
    article.prepend(bar);

    const content = () => article.querySelector('.article-body');
    const update = () => {
      const body = content();
      if (!body) return;
      const rect = body.getBoundingClientRect();
      const start = window.scrollY + rect.top - 120;
      const end = window.scrollY + rect.bottom - window.innerHeight;
      const pct = end <= start ? 100 : Math.max(0, Math.min(100, ((window.scrollY - start) / (end - start)) * 100));
      const fill = bar.querySelector('span');
      if (fill) fill.style.width = `${pct}%`;
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    const observer = new MutationObserver(() => {
      const body = content();
      if (!body || article.querySelector('.reading-time')) return;
      const words = (body.textContent || '').trim().split(/\s+/).filter(Boolean).length;
      const minutes = Math.max(1, Math.ceil(words / 220));
      const meta = document.createElement('p');
      meta.className = 'reading-time';
      meta.textContent = `Tempo de leitura: ${minutes} min`;
      const title = article.querySelector('#modal-title');
      if (title) title.insertAdjacentElement('afterend', meta);
      const top = document.createElement('button');
      top.type = 'button';
      top.className = 'back-to-top';
      top.setAttribute('aria-label', 'Voltar ao topo da matéria');
      top.textContent = '↑';
      top.title = 'Voltar ao topo';
      top.addEventListener('click', () => article.scrollTo({ top: 0, behavior: 'smooth' }));
      article.appendChild(top);
      update();
    });
    observer.observe(article, { childList: true, subtree: true });
  }
  function init() {
    addReadingUI();
    document.addEventListener('click', addReadingUI);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
