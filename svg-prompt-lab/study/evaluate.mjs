import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {deliverSvg} from '../../scripts/theater/svg.mjs';
import {validateSpriteSvg} from '../../server/middleware/validate.js';
const here=path.dirname(fileURLToPath(import.meta.url));
const study=JSON.parse(await fs.readFile(path.join(here,'study.json')));
const run=process.argv[2]||'pilot';if(!/^[a-zA-Z0-9_-]+$/.test(run))throw Error('Use a simple run name');
const runDir=path.join(here,'runs',run),out=path.join(runDir,'review');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage();await page.route('**/*',r=>r.abort());
const renderer={engine:'Chromium',version:browser.version(),longEdge:1024,delivery:'scripts/theater/svg.mjs',network:'blocked',probes:'Approximate mouth opacity and pupil translation; no full player animation'};
const results=[];
try {
 for(const trial of study.trials){const brief=study.briefs.find(b=>b.id===trial.briefId),dir=path.join(runDir,trial.id),file=path.join(dir,'asset.svg');
 const result={...trial,title:brief.title,kind:brief.kind,status:'missing',errors:[],warnings:[]};
 let svg;try{svg=await fs.readFile(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;results.push(result);continue;}
 result.status='submitted';result.bytes=Buffer.byteLength(svg);result.characters=svg.length;result.sha256=createHash('sha256').update(svg).digest('hex');
 try{result.provenance=JSON.parse(await fs.readFile(path.join(dir,'provenance.json')));}catch{result.warnings.push('Missing or invalid provenance.json');}
 if(brief.kind==='character'){const checked=validateSpriteSvg(svg);result.errors.push(...checked.errors);result.warnings.push(...checked.warnings);}
 if(result.characters>9000)result.warnings.push('Exceeded the requested 9000-character target (byte count shown separately)');
 const artifact=path.join(out,trial.id);
 try {
  if(!await fs.stat(artifact).catch(()=>false))await deliverSvg(artifact,{source:file,kind:'artwork',title:brief.title,model:result.provenance?.model||'Unknown'});
  else {const saved=await fs.readFile(path.join(artifact,'asset.svg'),'utf8');if(saved!==svg)throw Error('Review output is stale; choose a new run or explicitly remove its generated review directory');}
  result.preview=trial.id+'/preview.png';result.svg=trial.id+'/asset.svg';
  await page.setContent(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><div id="stage"></div>`);
  const geometry=await page.evaluate(({svg,kind})=>{
   const host=document.querySelector('#stage'),shadow=host.attachShadow({mode:'open'});shadow.innerHTML=svg;const root=shadow.querySelector('svg');root.style.width='400px';root.style.height='400px';
   const all=[...root.querySelectorAll('*')],ids=all.map(e=>e.id).filter(Boolean),duplicates=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
   const vb=root.viewBox.baseVal,box=root.getBBox();const errors=[],warnings=[];
   if(duplicates.length)errors.push('Duplicate IDs: '+duplicates.join(', '));
   const expected=kind==='character'?[0,0,100,150]:kind==='prop'?[0,0,100,100]:[0,0,400,225];
   if([vb.x,vb.y,vb.width,vb.height].some((n,i)=>n!==expected[i]))errors.push('Incorrect category viewBox');
   if(box.x<vb.x-.1||box.y<vb.y-.1||box.x+box.width>vb.x+vb.width+.1||box.y+box.height>vb.y+vb.height+.1)warnings.push('Geometry extends beyond viewBox (approximate bounds; stroke/filter extent is not measured)');
   if(kind!=='background'&&(box.x<vb.x+1||box.y<vb.y+1||box.x+box.width>vb.x+vb.width-1||box.y+box.height>vb.y+vb.height-1))warnings.push('Geometry approaches the canvas edge; inspect stroke clipping and safe margin');
   if(root.querySelector('text,image'))errors.push('Text or raster image violates the shared study contract');
   const bbox=e=>{const b=e.getBBox(),matrix=e.getCTM(),inverse=root.getCTM().inverse();const center=new DOMPoint(b.x+b.width/2,b.y+b.height/2).matrixTransform(matrix).matrixTransform(inverse);return {x:center.x,y:center.y};};
   let mouthDistance=null;
   if(kind==='background')for(const id of ['background','midground','foreground'])if(root.querySelector(`[id="${id}"]`)?.localName!=='g')errors.push('Missing named background layer: '+id);
   if(kind==='character'){
    const get=id=>root.querySelector(`[id="${id}"]`);
    for(const [id,tag,group] of [['eye-left-white','ellipse','head-top'],['eye-right-white','ellipse','head-top'],['eye-left-pupil','circle','head-top'],['eye-right-pupil','circle','head-top'],['brow-left','path','head-top'],['brow-right','path','head-top'],['mouth-open','ellipse','head-bottom'],['mouth-closed','path','head-bottom']]){
     const e=get(id);if(!e){errors.push('Missing '+id);continue;}if(e.localName!==tag)errors.push(id+' must be '+tag);if(!e.closest(`[id="${group}"]`))errors.push(id+' is outside '+group);
    }
    for(const id of ['body','head-top','head-bottom'])if(get(id)?.localName!=='g'||get(id)?.parentElement!==root)errors.push(id+' must be a direct root group');
    for(const id of ['eye-left-pupil','eye-right-pupil'])if(!get(id)?.classList.contains('pupil'))errors.push(id+' lacks pupil class');
    for(const side of ['left','right']){
     const pupil=get('eye-'+side+'-pupil'),white=get('eye-'+side+'-white');
     if(pupil?.localName==='circle'&&white?.localName==='ellipse'){
      const cx=white.cx.baseVal.value,cy=white.cy.baseVal.value,rx=white.rx.baseVal.value,ry=white.ry.baseVal.value;
      if(rx>0&&ry>0){const points=Array.from({length:24},(_,i)=>{const a=i*Math.PI/12;return new DOMPoint(pupil.cx.baseVal.value+pupil.r.baseVal.value*Math.cos(a),pupil.cy.baseVal.value+pupil.r.baseVal.value*Math.sin(a)).matrixTransform(pupil.getCTM()).matrixTransform(white.getCTM().inverse());});if(points.some(p=>((p.x-cx)/rx)**2+((p.y-cy)/ry)**2>1.03))warnings.push(side+' pupil geometry crosses eye white; inspect masking and gaze probe');}
     }
    }
    const open=get('mouth-open'),closed=get('mouth-closed');
    if(open&&['cx','cy','rx','ry'].some(a=>!open.hasAttribute(a)))errors.push('mouth-open requires explicit cx,cy,rx,ry');
    if(closed&&(getComputedStyle(closed).stroke==='none'||Number.parseFloat(getComputedStyle(closed).strokeWidth)===0))errors.push('mouth-closed must have a visible stroke');
    if(open&&closed){const a=bbox(open),b=bbox(closed);mouthDistance=Math.hypot(a.x-b.x,a.y-b.y);if(mouthDistance>3)warnings.push('Mouth centers differ by more than 3 viewBox units; inspect the mouth probe');if(getComputedStyle(open).opacity!=='0')errors.push('mouth-open must start hidden');}
   }
   return {errors,warnings,mouthDistance,elements:all.length,paths:root.querySelectorAll('path').length,groups:root.querySelectorAll('g').length,viewBox:[vb.x,vb.y,vb.width,vb.height]};
  },{svg,kind:brief.kind});
  result.errors.push(...geometry.errors);result.warnings.push(...geometry.warnings);result.geometry=geometry;
  if(brief.kind==='character'){
   for(const variant of ['mouth','gaze']){
    const modified=await page.evaluate(({svg,variant})=>{const doc=new DOMParser().parseFromString(svg,'image/svg+xml');if(variant==='mouth'){doc.querySelector('[id="mouth-open"]')?.setAttribute('opacity','1');doc.querySelector('[id="mouth-closed"]')?.setAttribute('opacity','0');}else for(const e of doc.querySelectorAll('.pupil'))e.setAttribute('transform',(e.getAttribute('transform')||'')+' translate(2 0)');return new XMLSerializer().serializeToString(doc);},{svg,variant});
    const temp=path.join(artifact,variant+'.svg');await fs.writeFile(temp,modified);
    const variantDir=path.join(artifact,variant);if(!await fs.stat(variantDir).catch(()=>false))await deliverSvg(variantDir,{source:temp,kind:'artwork'});
    result[variant]=trial.id+'/'+variant+'/preview.png';
   }
  }
  result.status=result.errors.length?'contract-failed':'passed';
 }catch(e){result.status='render-failed';result.errors.push(e.message);}
 result.errors=[...new Set(result.errors)];result.warnings=[...new Set(result.warnings)];results.push(result);
 }
}finally{await browser.close();}
const metadata=await fs.readFile(path.join(runDir,'run.json'),'utf8').then(JSON.parse).catch(()=>({mode:'unrecorded',limitation:'No execution provenance supplied'}));
const report={studyId:study.id,run,execution:metadata,renderer,generatedAt:new Date().toISOString(),briefs:study.briefs,methods:[...study.methods,{id:'visual-revision',title:'One visual-feedback revision'}],results};
await fs.writeFile(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');
await fs.copyFile(path.join(here,'review.html'),path.join(out,'index.html'));
await fs.copyFile(path.join(here,'notes.html'),path.join(out,'notes.html'));
if(await fs.stat(path.join(runDir,'observations.json')).catch(()=>false))await fs.copyFile(path.join(runDir,'observations.json'),path.join(out,'observations.json'));
const count=status=>results.filter(r=>r.status===status).length;
console.log(JSON.stringify({review:path.join(out,'index.html'),planned:results.length,passed:count('passed'),contractFailed:count('contract-failed'),renderFailed:count('render-failed'),missing:count('missing')},null,2));
