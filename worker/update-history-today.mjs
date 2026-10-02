import fs from 'node:fs/promises';

const now=new Date();
const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
const month=months[now.getUTCMonth()];
const day=now.getUTCDate();
const url=`https://www.computerhistory.org/tdih/${month}/${day}/`;
const html=await (await fetch(url,{headers:{'user-agent':'Tech Check/1.0'}})).text();
const clean=s=>s.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
const events=[];
const re=/<(?:h2|h3)[^>]*>([\s\S]*?)<\/(?:h2|h3)>/gi;
let m;while((m=re.exec(html))&&events.length<8){const title=clean(m[1]);if(!title||/what happened|image|birth|death|month/i.test(title))continue;const tail=clean(html.slice(re.lastIndex,re.lastIndex+2500));if(tail)events.push({title,summary:tail.slice(0,500)});}
await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/history-today.json',JSON.stringify({date:`${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,label:`${day} de ${month}`,source:'Computer History Museum',source_url:url,events},null,2));
console.log(`História de hoje: ${events.length} eventos`);
