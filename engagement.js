(() => {
  const KEY = 'techcheck-liked:' + location.pathname;
  function install() {
    if (document.querySelector('.site-engagement')) return;
    const host = document.querySelector('.article-body') || document.querySelector('main');
    if (!host) return;
    const box = document.createElement('div');
    box.className = 'site-engagement';
    box.setAttribute('aria-label', 'Ações da matéria');
    const liked = localStorage.getItem(KEY) === '1';
    box.innerHTML = `<button type="button" class="engagement-like" aria-label="Curtir esta matéria" aria-pressed="${liked}">${liked ? '♥ Curtido' : '♡ Curtir'}</button><button type="button" class="engagement-share" aria-label="Compartilhar esta matéria">↗ Compartilhar</button>`;
    host.insertAdjacentElement('afterend', box);
    const like = box.querySelector('.engagement-like');
    like.addEventListener('click', () => {
      const next = localStorage.getItem(KEY) !== '1';
      localStorage.setItem(KEY, next ? '1' : '0');
      like.textContent = next ? '♥ Curtido' : '♡ Curtir';
      like.setAttribute('aria-pressed', String(next));
    });
    box.querySelector('.engagement-share').addEventListener('click', async () => {
      const title = document.querySelector('h1,h2')?.textContent?.trim() || document.title;
      try {
        if (navigator.share) await navigator.share({ title, text: title, url: location.href });
        else await navigator.clipboard.writeText(location.href);
      } catch (_) {}
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
  new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
})();
