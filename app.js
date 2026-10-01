const demoNews = [
  {category:'INTELIGÊNCIA ARTIFICIAL',time:'Demonstração',title:'Como uma nova geração de modelos de IA pode mudar os aplicativos que usamos todos os dias',text:'Exemplo de matéria do MVP. O conteúdo real virá do pipeline de fontes, verificação, tradução e redação automática.'},
  {category:'HARDWARE',time:'Demonstração',title:'Novos chips estão tentando levar mais processamento de IA para dentro dos dispositivos',text:'Exemplo de estrutura editorial: fato principal, contexto e explicação sem exageros ou promessas que a fonte não sustenta.'},
  {category:'INTERNET',time:'Demonstração',title:'A tecnologia por trás de uma mudança silenciosa na forma como a internet funciona',text:'A versão final vai cruzar fontes quando possível e indicar exatamente de onde as informações foram obtidas.'},
  {category:'CIÊNCIA',time:'Demonstração',title:'Uma descoberta tecnológica pode abrir novas possibilidades para pesquisadores',text:'Esta área será usada para notícias verificadas e traduzidas, com linguagem natural e leitura agradável.'},
  {category:'GADGETS',time:'Demonstração',title:'O que realmente muda quando um novo dispositivo chega ao mercado',text:'A matéria final separará dados confirmados, declarações dos fabricantes e possíveis desdobramentos.'},
  {category:'TECNOLOGIA',time:'Demonstração',title:'O que pode acontecer daqui para frente?',text:'A seção de extrapolação ficará separada da notícia e identificará cenários próximos, futuros e especulativos.'}
];

const grid = document.querySelector('#news-grid');
grid.innerHTML = demoNews.map((item) => `
  <article class="news-card">
    <div class="card-image">IMAGEM DA MATÉRIA · SERÁ SUBSTITUÍDA PELO PIPELINE</div>
    <div class="card-body">
      <div class="card-meta"><span>${item.category}</span><span>${item.time}</span></div>
      <h3>${item.title}</h3>
      <p>${item.text}</p>
    </div>
  </article>
`).join('');
