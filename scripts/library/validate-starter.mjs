import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {validateSvg} from '../../worker/community-worker.js';
import {validateSpriteSvg} from '../../server/middleware/validate.js';
const root=path.resolve('assets/starter-library'),items=[];
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 for(const category of ['characters','backgrounds','props']){
  for(const entry of (await fs.readdir(path.join(root,category),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
   if(!entry.isDirectory())continue;const dir=path.join(root,category,entry.name);
   const meta=await fs.readFile(path.join(dir,'meta.json'),'utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(!meta)continue;
   if(!meta.name||!meta.description||!Array.isArray(meta.tags)||!meta.tags.length||meta.tags.length>8||meta.model!=='GPT-6 Astra')throw Error('Missing searchable metadata '+dir);
   const files=category==='characters'?['front.svg']:category==='props'?['prop.svg']:['landscape.svg','portrait.svg'];const sha256={};
   for(const file of files){
    const svg=await fs.readFile(path.join(dir,file),'utf8');const unsafe=validateSvg(svg);if(unsafe)throw Error(dir+'/'+file+': '+unsafe);
    const parsed=await page.evaluate(svg=>{const d=new DOMParser().parseFromString(svg,'image/svg+xml');if(d.querySelector('parsererror'))throw Error('Malformed XML');const box=d.documentElement.getAttribute('viewBox').split(/[ ,]+/).map(Number);return {box,xml:new XMLSerializer().serializeToString(d)};},svg);
    if(parsed.box.length!==4||!parsed.box.every(Number.isFinite)||parsed.box[2]<=0||parsed.box[3]<=0)throw Error('Bad viewBox '+dir);
    if(category==='characters'){const v=validateSpriteSvg(parsed.xml);if(!v.valid)throw Error(dir+': '+v.errors.join('; '));}
    if(category==='backgrounds'&&Math.abs(parsed.box[2]/parsed.box[3]-(file==='portrait.svg'?9/16:16/9))>0.000001)throw Error('Incorrect orientation '+dir);
    sha256[file]=createHash('sha256').update(svg).digest('hex');
   }
   items.push({id:entry.name,category,name:meta.name,description:meta.description,tags:meta.tags,model:meta.model,files,sha256});
  }
 }
}finally{await browser.close();}
const counts=Object.fromEntries(['characters','backgrounds','props'].map(c=>[c,items.filter(x=>x.category===c).length]));
if(counts.characters!==40||counts.backgrounds!==30||counts.props!==30)throw Error('Incomplete library '+JSON.stringify(counts));
await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify({version:1,counts,items},null,2)+'\n');console.log('Validated',counts,'SVG files',items.reduce((n,i)=>n+i.files.length,0));
