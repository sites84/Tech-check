(function(){
  function proxy(url){return 'https://images.weserv.nl/?url='+encodeURIComponent(url)+'&output=webp&il&n=-1'}
  function prepare(img){
    if(!img||img.dataset.imageFix)return;
    const original=img.getAttribute('src')||'';
    if(!original)return;
    img.dataset.imageFix='1';
    img.dataset.originalSrc=original;
    img.removeAttribute('referrerpolicy');
    img.referrerPolicy='';
    img.dataset.imageStage='0';
  }
  function scan(root){
    if(!root||!root.querySelectorAll)return;
    root.querySelectorAll('img.real-image,img.modal-hero-image').forEach(prepare);
  }
  document.addEventListener('error',function(ev){
    const img=ev.target;
    if(!img||img.tagName!=='IMG'||!img.classList.contains('real-image'))return;
    if(img.dataset.imageFix!=='1')prepare(img);
    ev.stopImmediatePropagation();
    const original=img.dataset.originalSrc||'';
    const stage=img.dataset.imageStage||'0';
    if(stage==='0'){
      img.dataset.imageStage='1';
      img.src=proxy(original);
      return;
    }
    if(stage==='1'){
      img.dataset.imageStage='2';
      img.src=original;
      return;
    }
    const box=document.createElement('div');
    box.className='card-image image-fallback';
    box.innerHTML='<span>Imagem indisponível</span>';
    img.replaceWith(box);
  },true);
  const observer=new MutationObserver(function(mutations){mutations.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1){if(n.matches&&n.matches('img.real-image,img.modal-hero-image'))prepare(n);scan(n)}}))});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  scan(document);
})();