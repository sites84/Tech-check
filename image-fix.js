(function(){
  function proxy(url){return 'https://images.weserv.nl/?url='+encodeURIComponent(url)+'&output=webp&il&n=-1'}
  function prepare(img){
    if(!img||img.dataset.imageFix)return;
    img.dataset.imageFix='1';
    const original=img.getAttribute('src')||'';
    if(!original)return;
    img.dataset.originalSrc=original;
    img.removeAttribute('referrerpolicy');
    img.referrerPolicy='';
    img.dataset.proxyTried='0';
    img.addEventListener('error',function(){
      if(img.dataset.proxyTried==='0'){
        img.dataset.proxyTried='1';
        img.src=proxy(img.dataset.originalSrc);
        return;
      }
      if(img.dataset.proxyTried==='1'){
        img.dataset.proxyTried='2';
        img.src=img.dataset.originalSrc;
        return;
      }
      const box=document.createElement('div');
      box.className='card-image image-fallback';
      box.innerHTML='<span>Imagem indisponível</span>';
      img.replaceWith(box);
    },true);
  }
  function scan(root){
    if(!root||!root.querySelectorAll)return;
    root.querySelectorAll('img.real-image,img.modal-hero-image').forEach(prepare);
  }
  const observer=new MutationObserver(function(mutations){mutations.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1){if(n.matches&&n.matches('img.real-image,img.modal-hero-image'))prepare(n);scan(n)}}))});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  scan(document);
})();