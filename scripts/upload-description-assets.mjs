#!/usr/bin/env node
// Upload the approved reusable assets once; retain a receipt to avoid duplicates.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const receiptPath=path.join(root,'docs/description-pouch-assets.json');
let receipt={published:'the-description-f8ccb1'};
try { receipt=JSON.parse(await fs.readFile(receiptPath,'utf8')); } catch(e) { if(e.code!=='ENOENT')throw e; }
const read=file=>fs.readFile(path.join(root,file),'utf8');
const api='https://pelicans-community.sam-cloudflare-d20.workers.dev/api/community';
const upload=async(category,key,payload)=>{
 if(receipt[key]) { console.log('Already uploaded',key); return; }
 const response=await fetch(`${api}/${category}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'sampatt',model:'GPT-6 Astra',...payload})});
 const result=await response.json();if(!response.ok)throw Error(JSON.stringify(result));
 receipt[key]=result.slug;await fs.writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n');console.log(category,key,result.slug);
};
for(const name of ['burglar','disguise','hidden','turned','officer','officer-lowered']) {
 const id=`description-${name}`;
 await upload('characters',id,{meta:JSON.parse(await read(`src/sprites/${id}/meta.json`)),variants:{front:await read(`src/sprites/${id}/front.svg`)}});
}
for(const name of ['scanner','loot']) {
 const id=`description-${name}`;
 await upload('props',id,{meta:JSON.parse(await read(`src/props/${id}/meta.json`)),svg:await read(`src/props/${id}/prop.svg`)});
}
for(const name of ['harbor','black']) {
 const id=`description-${name}`;
 await upload('backgrounds',id,{name:id,landscape_svg:await read(`src/backgrounds/${id}/landscape.svg`)});
}
const skit=JSON.parse(await read('src/published/theDescription.json'));delete skit.assets;
await upload('skits','script',{skit});
