(() => {
  const SITE='';
  const slug=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' e ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90);
  function localizeImages(root=document){root.querySelectorAll('.news-card img').forEach(img=>{const card=img.closest('.news-card');const link=card?.querySelector('a.read-button');if(!link)return;try{const u=new URL(link.href,location.href),m=u.pathname.match(/\/noticias\/([^/]+)\/?$/);if(!m)return;const local=`${location.origin}${location.pathname.split('/').slice(0,-1).join('/')}/assets/news/${decodeURIComponent(m[1])}.webp`;if(img.dataset.localApplied)return;img.dataset.localApplied='1';img.src=local;img.referrerPolicy='no-referrer';img.onerror=()=>{const box=document.createElement('div');box.className='card-image image-fallback';box.textContent='IMAGEM DA FONTE NÃO DISPONÍVEL';img.replaceWith(box)}}catch{}})}
  function rewriteLinks(root=document){root.querySelectorAll('a.read-button').forEach(a=>{try{const u=new URL(a.href,location.href);if(!u.pathname.includes('/noticias/'))return;a.href=u.href}catch{}})}
  function patch(){localizeImages();rewriteLinks()}
  document.addEventListener('click',e=>{const a=e.target.closest?.('a.read-button');if(!a)return;if(a.origin===location.origin&&a.pathname.includes('/noticias/')){e.preventDefault();e.stopImmediatePropagation();location.href=a.href}},true);
  new MutationObserver(patch).observe(document.body,{subtree:true,childList:true});
  window.addEventListener('load',patch);setTimeout(patch,300);setTimeout(patch,1200);
})();
