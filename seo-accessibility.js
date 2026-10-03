(function(){
  function cleanTitle(v){return String(v||'').replace(/\s+/g,' ').trim();}
  function applySeoAccessibility(){
    document.querySelectorAll('img').forEach(function(img){
      if(!img.getAttribute('alt')||!img.getAttribute('alt').trim()){
        var card=img.closest('article,.news-card,.trending-card,.category-card,.evergreen-card');
        var title=card&&card.querySelector('h1,h2,h3,h4');
        var text=cleanTitle(title&&title.textContent);
        if(!text){
          var heading=document.querySelector('h1');
          text=cleanTitle(heading&&heading.textContent);
        }
        img.setAttribute('alt',text||'Imagem da matéria do Tech Check');
      }
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applySeoAccessibility);else applySeoAccessibility();
  new MutationObserver(applySeoAccessibility).observe(document.body,{childList:true,subtree:true});
})();
