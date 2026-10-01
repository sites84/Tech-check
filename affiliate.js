const AFFILIATE_API='https://ymiqcnzulxbshjrnaujv.supabase.co/rest/v1/affiliate_products?active=eq.true&select=category,product_name,affiliate_url,keywords';
const AFFILIATE_KEY='sb_publishable_-rbhLGxEgLXlfMZ64W7ypw_xyy3aLjR';
let affiliateProducts=[];
const affiliateHeaders={apikey:AFFILIATE_KEY,Authorization:`Bearer ${AFFILIATE_KEY}`};
function affiliateNorm(v=''){return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function chooseAffiliateProduct(){
  const modal=document.querySelector('#modal-content');
  if(!modal||!affiliateProducts.length)return null;
  const text=affiliateNorm(`${modal.querySelector('#modal-title')?.textContent||''} ${modal.querySelector('.modal-summary')?.textContent||''} ${modal.querySelector('.eyebrow')?.textContent||''}`);
  let best=null,bestScore=0;
  affiliateProducts.forEach(p=>{
    const hay=affiliateNorm(`${p.category||''} ${p.product_name||''} ${(p.keywords||[]).join(' ')}`);
    let score=0;
    const category=affiliateNorm(p.category||'');
    if(category&&text.includes(category))score+=8;
    (p.keywords||[]).forEach(k=>{const key=affiliateNorm(k);if(key.length>2&&text.includes(key))score+=3;});
    affiliateNorm(p.product_name||'').split(/\s+/).forEach(k=>{if(k.length>3&&text.includes(k))score+=2;});
    if(score>bestScore){bestScore=score;best=p;}
  });
  return bestScore>=3?best:null;
}
function renderAffiliate(){
  const modal=document.querySelector('#modal-content');
  if(!modal||modal.querySelector('.affiliate-box'))return;
  const product=chooseAffiliateProduct();
  if(!product)return;
  const source=modal.querySelector('.source-box');
  const box=document.createElement('section');
  box.className='affiliate-box';
  box.innerHTML=`<p class="eyebrow">PRODUTO RELACIONADO</p><h3>${escapeHtml(product.product_name)}</h3><p>Encontre produtos relacionados a esta matéria na Shopee.</p><a class="affiliate-button" href="${escapeHtml(product.affiliate_url)}" target="_blank" rel="sponsored noopener noreferrer">Ver produto na Shopee ↗</a><small>Link de afiliado. O Tech Check pode receber comissão pela compra.</small>`;
  if(source)modal.insertBefore(box,source);else modal.appendChild(box);
}
async function loadAffiliateProducts(){
  try{const r=await fetch(AFFILIATE_API,{headers:affiliateHeaders});if(!r.ok)return;affiliateProducts=await r.json();renderAffiliate();}catch(e){console.warn('Afiliados:',e);}
}
const affiliateObserver=new MutationObserver(()=>{if(affiliateProducts.length)renderAffiliate();});
const modalContent=document.querySelector('#modal-content');
if(modalContent)affiliateObserver.observe(modalContent,{childList:true,subtree:true});
loadAffiliateProducts();
