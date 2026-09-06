import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
const here=path.dirname(fileURLToPath(import.meta.url));
const run=process.argv[2]||'astra-isolated';
if(!/^[a-zA-Z0-9_-]+$/.test(run))throw Error('Use a simple run name');
const root=path.join(here,'runs',run,'review');
const report=JSON.parse(await fs.readFile(path.join(root,'results.json')));
const browser=await chromium.launch();
try{const page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1});await page.route('**/*',r=>r.abort());
for(const brief of report.briefs){const trials=report.results.filter(r=>r.briefId===brief.id).sort((a,b)=>a.promptSha256.localeCompare(b.promptSha256));
await page.setContent('<style>body{margin:0;padding:24px;background:#f7f5ed;color:#173b40;font:16px system-ui}h1{margin:0 0 18px;font-size:28px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}article{background:#edf1ef;padding:10px;border:1px solid #b7c9c7}img{width:100%;height:280px;object-fit:contain}p{margin:5px 0;font-weight:600}</style><h1></h1><div class="grid"></div>');
const cards=[];for(const [i,t] of trials.entries())cards.push({label:'Candidate '+(i+1),src:t.preview?'data:image/png;base64,'+(await fs.readFile(path.join(root,t.preview))).toString('base64'):null});
await page.evaluate(({title,cards})=>{document.querySelector('h1').textContent=title;for(const c of cards){const a=document.createElement('article');if(c.src){const img=new Image();img.src=c.src;a.append(img)}else{const missing=document.createElement('div');missing.style.height='280px';missing.textContent='No preview';a.append(missing)}const p=document.createElement('p');p.textContent=c.label;a.append(p);document.querySelector('.grid').append(a)}},{title:brief.title,cards});
await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));await page.screenshot({path:path.join(root,brief.id+'-sheet.png'),fullPage:true});
}
}finally{await browser.close();}
console.log('Created six contact sheets using the gallery candidate order.');
