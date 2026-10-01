const AFFILIATE_API='https://ymiqcnzulxbshjrnaujv.supabase.co/rest/v1/affiliate_products?active=eq.true&select=category,product_name,affiliate_url,keywords';
const AFFILIATE_KEY='sb_publishable_-rbhLGxEgLXlfMZ64W7ypw_xyy3aLjR';
let affiliateProducts=[];
const affiliateHeaders={apikey:AFFILIATE_KEY,Authorization:`Bearer ${AFFILIATE_KEY}`};
function affiliateNorm(v=''){return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function chooseAffiliateProduct(){
  const modal=document.querySelector('#modal-content');
  if(!modal||!affiliateProducts.length)return null;
  const title=modal.querySelector('#modal-title')?.textContent||'';
  const summary=modal.querySelector('.modal-summary')?.textContent||'';
  const eyebrow=modal.querySelector('.eyebrow')?.textContent||'';
  const text=affiliateNorm(`${title} ${summary} ${eyebrow}`);
  const categoryMap={
    'inteligencia artificial':'IA e criação','ia':'IA e criação','smartphones':'Celulares','celulares':'Celulares',
    'computadores':'Computadores','games':'Games','seguranca':'Acessórios','ciencia':'Acessórios','espaco':'Acessórios',
    'gadgets':'Acessórios','internet':'Redes','cripto':'Computadores','empresas':'Notebooks','historia da tecnologia':'Computadores',
    'curiosidades':'Acessórios','como funciona?':'Acessórios','kindle':'Tablets','e-reader':'Tablets','ereader':'Tablets','leitor digital':'Tablets'
  };
  let best=null,bestScore=-1;
  affiliateProducts.forEach(p=>{
    let score=0;
    const category=affiliateNorm(p.category||'');
    const productName=affiliateNorm(p.product_name||'');
    const keywords=(p.keywords||[]).map(affiliateNorm);
    if(category&&text.includes(category))score+=8;
    for(const [key,target] of Object.entries(categoryMap)){
      if(text.includes(key)&&category===affiliateNorm(target))score+=7;
    }
    keywords.forEach(key=>{if(key.length>2&&text.includes(key))score+=4;});
    productName.split(/\s+/).forEach(k=>{if(k.length>3&&text.includes(k))score+=2;});
    if(score>bestScore){bestScore=score;best=p;}
  });
  return best;
}
function renderAffiliate(){
  const modal=document.querySelector('#modal-content');
  if(!modal||modal.querySelector('.affiliate-box')||!affiliateProducts.length)return;
  const product=chooseAffiliateProduct();
  if(!product?.affiliate_url)return;
  const source=modal.querySelector('.source-box');
  const box=document.createElement('section');
  box.className='affiliate-box';
  box.innerHTML=`<p class="eyebrow">PRODUTO RELACIONADO</p><h3>${escapeHtml(product.product_name)}</h3><p>Encontre este tipo de produto na Shopee.</p><a class="affiliate-button" href="${escapeHtml(product.affiliate_url)}" target="_blank" rel="sponsored noopener noreferrer">Ver produto na Shopee ↗</a><small>Link de afiliado. O Tech Check pode receber comissão pela compra.</small>`;
  if(source)source.insertAdjacentElement('afterend',box);else modal.appendChild(box);
}
async function loadAffiliateProducts(){
  try{
    const r=await fetch(AFFILIATE_API,{headers:affiliateHeaders,cache:'no-store'});
    if(!r.ok)throw new Error(`Supabase ${r.status}`);
    const data=await r.json();
    affiliateProducts=Array.isArray(data)?data.filter(p=>p.affiliate_url):[];
    renderAffiliate();
  }catch(e){console.warn('Afiliados:',e);}
}
const affiliateObserver=new MutationObserver(()=>{if(affiliateProducts.length)renderAffiliate();});
const modalContent=document.querySelector('#modal-content');
if(modalContent)affiliateObserver.observe(modalContent,{childList:true,subtree:true});
loadAffiliateProducts();
