(()=>{
  const KEY='techcheck-dark';
  const style=document.createElement('style');
  style.textContent=`
    .dark-mode{--bg:#101418;--panel:#171c21;--panel2:#222930;--text:#edf2f5;--muted:#aab5be;--line:#303941;--accent-soft:#123b2f}
    .dark-mode body,.dark-mode{background:var(--bg);color:var(--text)}
    .dark-mode .site-header{background:rgba(16,20,24,.96);border-color:var(--line)}
    .dark-mode .article-page article{background:var(--panel);box-shadow:0 18px 55px rgba(0,0,0,.25)}
    .dark-mode .article-page h1,.dark-mode .article-body h2,.dark-mode .article-extra h2{color:var(--text)}
    .dark-mode .article-lead,.dark-mode .article-body,.dark-mode .article-extra p,.dark-mode .source,.dark-mode .read-also .related-card span{color:var(--muted)}
    .dark-mode .article-extra{background:#14221d;border-left-color:var(--accent)}
    .dark-mode .source{border-color:var(--line)}
    .dark-mode .read-also{border-color:var(--line)}
    .dark-mode .read-also .related-card{background:var(--panel);border-color:var(--line);color:var(--text)}
    .dark-mode .read-also .related-card-title{color:var(--text)}
    .dark-mode .back-link,.dark-mode .source a,.dark-mode .article-page .eyebrow{color:#45c99a}
    .article-dark-toggle{position:fixed;right:16px;top:84px;z-index:20;border:1px solid var(--line,#dfe4e8);background:var(--panel,#fff);color:var(--text,#17202a);border-radius:999px;padding:8px 12px;font-weight:800;cursor:pointer;box-shadow:0 5px 18px rgba(0,0,0,.12)}
  `;
  document.head.appendChild(style);
  const dark=localStorage.getItem(KEY)!=='0';
  document.documentElement.classList.toggle('dark-mode',dark);
  document.body.classList.toggle('dark-mode',dark);
  const b=document.createElement('button');b.className='article-dark-toggle';b.type='button';
  const render=()=>b.textContent=document.body.classList.contains('dark-mode')?'☀️ Claro':'🌙 Escuro';
  b.onclick=()=>{const on=!document.body.classList.contains('dark-mode');document.body.classList.toggle('dark-mode',on);document.documentElement.classList.toggle('dark-mode',on);localStorage.setItem(KEY,on?'1':'0');render()};
  document.body.appendChild(b);render();
})();
