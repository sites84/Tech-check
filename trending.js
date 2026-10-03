const TRENDING_URL=`${SUPABASE_URL}/rest/v1/trending_articles?cycle_ends_at=gt.${encodeURIComponent(new Date().toISOString())}&select=article_id,rank,score,cycle_started_at,cycle_ends_at&order=rank.asc&limit=10`;

async function loadTrending(){
  const box=document.querySelector('#trending-carousel');
  const status=document.querySelector('#trending-status');
  if(!box)return;
  try{
    const r=await fetch(TRENDING_URL,{headers:apiHeaders});
    if(!r.ok)throw new Error('trending '+r.status);
    let rows=await r.json();
    let fallback=false;

    if(!rows.length){
      const recent=await fetch(`${SUPABASE_URL}/rest/v1/articles?status=eq.review&select=id,title,summary,content,why_it_matters,future_outlook,image_url,cached_image_url,original_url,published_at,created_at&order=published_at.desc.nullslast,created_at.desc&limit=10`,{headers:apiHeaders});
      if(!recent.ok)throw new Error('recent articles '+recent.status);
      const articles=await recent.json();
      rows=articles.map((a,i)=>({article_id:a.id,rank:i+1,score:0,cycle_started_at:null,cycle_ends_at:null}));
      fallback=true;
    }

    const ids=rows.map(x=>x.article_id).join(',');
    const ar=await fetch(`${SUPABASE_URL}/rest/v1/articles?id=in.(${ids})&status=eq.review&select=id,title,summary,content,why_it_matters,future_outlook,image_url,cached_image_url,original_url,published_at,created_at`,{headers:apiHeaders});
    if(!ar.ok)throw new Error('articles '+ar.status);
    const articles=await ar.json();
    const byId=new Map(articles.map(a=>[a.id,a]));

    box.innerHTML=rows.map(row=>{
      const a=byId.get(row.article_id);
      if(!a)return '';
      const image=(a.cached_image_url||a.image_url)?`<img class="trending-card-image" src="${escapeHtml(a.cached_image_url||a.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:'<div class="trending-placeholder" aria-hidden="true"></div>';
      return `<article class="trending-card" data-trending-id="${escapeHtml(a.id)}">${image}<div class="trending-card-body"><h3>${escapeHtml(a.title)}</h3><div class="trending-meta">${formatDate(a.published_at||a.created_at)}</div></div></article>`;
    }).join('');

    box.querySelectorAll('.trending-card-image').forEach(img=>{
      img.addEventListener('error',()=>{
        const placeholder=document.createElement('div');
        placeholder.className='trending-placeholder';
        placeholder.setAttribute('aria-hidden','true');
        img.replaceWith(placeholder);
      },{once:true});
    });

    box.querySelectorAll('[data-trending-id]').forEach(card=>card.addEventListener('click',()=>{
      const a=byId.get(card.dataset.trendingId);
      if(a)openArticle(a);
    }));

    if(status){
      if(fallback)status.textContent='Destaques recentes';
      else{
        const end=new Date(rows[0].cycle_ends_at);
        status.textContent=`Próxima atualização: ${new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(end)}`;
      }
    }
  }catch(e){
    console.error('Trending:',e);
    box.innerHTML='';
  }
}

function setupTrendingArrows(){
  const box=document.querySelector('#trending-carousel');
  document.querySelector('#trending-prev')?.addEventListener('click',()=>box?.scrollBy({left:-360,behavior:'smooth'}));
  document.querySelector('#trending-next')?.addEventListener('click',()=>box?.scrollBy({left:360,behavior:'smooth'}));
}

loadTrending();
setupTrendingArrows();
