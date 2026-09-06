import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {chromium} from '@playwright/test';
import {run} from '../../scripts/theater/project.mjs';

test('SVG study retains failures, renders expression probes, and keeps methods hidden until reveal',async t=>{
 const name='harness-'+Date.now(),root=path.resolve('svg-prompt-lab/study/runs',name);await fs.mkdir(root,{recursive:true});t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const prop='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="#19616b"/></svg>';
 await run(process.execPath,['scripts/theater.mjs','init',path.join(root,'fixture'),'--silent']);
 const character=await fs.readFile(path.join(root,'fixture/assets/pelican.svg'),'utf8');
 for(const [id,svg] of [['t001',character],['t011',prop],['t012',prop.replace('</svg>','')],['t013',prop.replace('100 100','200 100')]]){
  await fs.mkdir(path.join(root,id));await fs.writeFile(path.join(root,id,'asset.svg'),svg);await fs.writeFile(path.join(root,id,'provenance.json'),JSON.stringify({model:'Harness fixture',rendered:false}));
 }
 await fs.writeFile(path.join(root,'run.json'),JSON.stringify({mode:'Harness test',limitation:'Fixtures are not generation trials.'}));
 const result=JSON.parse((await run(process.execPath,['svg-prompt-lab/study/evaluate.mjs',name],{timeout:60000})).toString());
 assert.equal(result.planned,42);assert.equal(result.passed,2);assert.equal(result.contractFailed,1);assert.equal(result.renderFailed,1);assert.equal(result.missing,38);
 const report=JSON.parse(await fs.readFile(path.join(root,'review/results.json')));assert.ok(report.results.find(r=>r.id==='t001').mouth);assert.equal(await fs.readFile(path.join(root,'t012/asset.svg'),'utf8'),prop.replace('</svg>',''));
 const webRoot=path.join(root,'review');const server=createServer(async(req,res)=>{try{const relative=new URL(req.url,'http://localhost').pathname;const file=path.resolve(webRoot,'.'+relative+(relative==='/'?'index.html':''));if(!file.startsWith(webRoot+path.sep))throw Error('outside');res.setHeader('Content-Type',file.endsWith('.json')?'application/json':file.endsWith('.png')?'image/png':'text/html');res.end(await fs.readFile(file));}catch{res.statusCode=404;res.end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const browser=await chromium.launch();t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('.card').first().waitFor();
 assert.equal(await page.getByText('Minimal contract',{exact:false}).count(),0);assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth<=window.innerWidth),true);
 await page.locator('#brief').selectOption('clock');const card=page.locator('.card').filter({has:page.locator('img')}).first();await card.locator('input[type=checkbox]').check();
 await page.locator('#reveal').click();assert.ok(await page.getByText('Minimal contract',{exact:false}).count()>0);await page.locator('#reveal').click();
 const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;const file=await download.path();const ratings=JSON.parse(await fs.readFile(file));assert.equal(ratings.methodsRevealed,false);assert.equal(ratings.methodsEverRevealed,true);assert.ok(Object.values(ratings.ratings).some(r=>r.favorite));
});

test('the frozen study is balanced and every dispatch prompt matches its recorded hash',async()=>{
 const root=path.resolve('svg-prompt-lab/study'),study=JSON.parse(await fs.readFile(path.join(root,'study.json')));
 assert.equal(study.briefs.length,6);assert.equal(study.methods.length,5);assert.equal(study.trials.length,42);assert.equal(new Set(study.dispatchOrder).size,42);
 for(const b of study.briefs){const trials=study.trials.filter(t=>t.briefId===b.id);assert.equal(trials.length,7);assert.equal(new Set(trials.filter(t=>t.phase==='first-pass').map(t=>t.methodId)).size,5);const revision=trials.find(t=>t.phase==='revision');assert.equal(trials.find(t=>t.id===revision.parent).methodId,'minimal');}
 for(const trial of study.trials){const prompt=await fs.readFile(path.join(root,'prompts',trial.id+'.md'));assert.equal(createHash('sha256').update(prompt).digest('hex'),trial.promptSha256);}
});
