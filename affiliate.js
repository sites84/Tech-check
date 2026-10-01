const AFFILIATE_API='https://ymiqcnzulxbshjrnaujv.supabase.co/rest/v1/affiliate_products?active=eq.true&select=category,product_name,affiliate_url,keywords';
const AFFILIATE_KEY='sb_publishable_-rbhLGxEgLXlfMZ64W7ypw_xyy3aLjR';
let affiliateProducts=[];
const affiliateHeaders={apikey:AFFILIATE_KEY,Authorization:`Bearer ${AFFILIATE_KEY}`};

function affiliateNorm(v=''){
  return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}

function affiliateKeywords(value){
  if(Array.isArray(value)) return value.map(affiliateNorm).filter(Boolean);
  if(typeof value==='string'){
    try{
      const parsed=JSON.parse(value);
      if(Array.isArray(parsed)) return parsed.map(affiliateNorm).filter(Boolean);
    }catch(e){}
    return value.split(/[,;|]/).map(affiliateNorm).filter(Boolean);
  }
  return [];
}

function chooseAffiliateProduct(){
  if(!affiliateProducts.length)return null;
  const modal=document.querySelector('#modal-content');
  if(!modal)return null;
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
    if(!p?.affiliate_url)return;
    let score=0;
    const category=affiliateNorm(p.category||'');
    const productName=affiliateNorm(p.product_name||'');
    const keywords=affiliateKeywords(p.keywords);
    if(category&&text.includes(category))score+=8;
    for(const [key,target] of Object.entries(categoryMap)){
      if(text.includes(key)&&category===affiliateNorm(target))score+=7;
    }
    keywords.forEach(key=>{if(key.length>2&&text.includes(key))score+=4;});
    productName.split(/\s+/).forEach(k=>{if(k.length>3&&text.includes(k))score+=2;});
    if(score>bestScore){bestScore=score;best=p;}
  });
  return best||affiliateProducts.find(p=>p?.affiliate_url)||null;
}

function renderAffiliate(){
  const modal=document.querySelector('#modal-content');
  if(!modal||!affiliateProducts.length)return;
  if(modal.querySelector('.affiliate-box'))return;
  const product=chooseAffiliateProduct();
  if(!product?.affiliate_url)return;
  const source=modal.querySelector('.source-box');
  const box=document.createElement('section');
  box.className='affiliate-box';
  box.innerHTML=`<p class="eyebrow">PRODUTO RELACIONADO</p><h3>${escapeHtml(product.product_name||'Produto relacionado')}</h3><p>Encontre este tipo de produto na Shopee.</p><a class="affiliate-button" href="${escapeHtml(product.affiliate_url)}" target="_blank" rel="sponsored noopener noreferrer">Ver produto na Shopee ↗</a><small>Link de afiliado. O Tech Check pode receber comissão pela compra.</small>`;
  if(source)source.insertAdjacentElement('afterend',box);else modal.appendChild(box);
}

async function loadAffiliateProducts(){
  try{
    const r=await fetch(AFFILIATE_API,{headers:affiliateHeaders,cache:'no-store'});
    if(!r.ok)throw new Error(`Supabase ${r.status}`);
    const data=await r.json();
    affiliateProducts=Array.isArray(data)?data.filter(p=>p&&p.affiliate_url):[];
    renderAffiliate();
  }catch(e){
    console.warn('Afiliados:',e);
    affiliateProducts=[];
  }
}

// Observa o documento inteiro porque o conteúdo da matéria é recriado toda vez que o usuário abre uma postagem.
const affiliateObserver=new MutationObserver(()=>{
  if(affiliateProducts.length)renderAffiliate();
});
affiliateObserver.observe(document.body,{childList:true,subtree:true});

// Também tenta novamente quando uma matéria é aberta.
document.addEventListener('click',()=>{
  if(affiliateProducts.length)setTimeout(renderAffiliate,50);
  if(affiliateProducts.length)setTimeout(renderAffiliate,300);
});

loadAffiliateProducts();
