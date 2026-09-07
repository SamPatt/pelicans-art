// Publish only the reviewed starter-library manifest. Receipts prevent duplicate
// POSTs; uncertain requests stop for reconciliation rather than retrying blindly.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve('assets/starter-library');
const api='https://pelicans-community.sam-cloudflare-d20.workers.dev/api/community';
const receiptFile=path.resolve('data/starter-library/upload-receipts.json');
const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json')));
const receipts=await fs.readFile(receiptFile,'utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return {};throw e;});
const hash=b=>createHash('sha256').update(b).digest('hex');
const save=async()=>{await fs.mkdir(path.dirname(receiptFile),{recursive:true});await fs.writeFile(receiptFile+'.tmp',JSON.stringify(receipts,null,2)+'\n');await fs.rename(receiptFile+'.tmp',receiptFile);};
for(const item of manifest.items){
 const key=`${item.category}/${item.id}`;
 if(receipts[key]?.verified){console.log('verified',key);continue;}
 const dir=path.join(root,key),meta=JSON.parse(await fs.readFile(path.join(dir,'meta.json')));
 const files={};for(const f of item.files){const text=await fs.readFile(path.join(dir,f),'utf8');if(hash(text)!==item.sha256[f])throw Error('Artwork changed since review: '+key+'/'+f);files[f]=text;}
 if(receipts[key]?.uncertain)throw Error('Reconcile uncertain prior POST: '+key);
 if(!receipts[key]?.slug){
  const body={username:'SamPatt',name:meta.name,description:meta.description,tags:meta.tags,model:'GPT-6 Astra',meta};
  if(item.category==='characters')body.variants={front:files['front.svg']};
  else if(item.category==='props')body.svg=files['prop.svg'];
  else{body.landscape_svg=files['landscape.svg'];body.portrait_svg=files['portrait.svg'];}
  receipts[key]={uncertain:true,startedAt:new Date().toISOString()};await save();
  const response=await fetch(`${api}/${item.category}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  if(response.status===429){delete receipts[key];await save();throw Error('Rate limited; resume after cooldown.');}
  const result=await response.json();if(!response.ok||!result.ok)throw Error(JSON.stringify({key,status:response.status,result}));
  receipts[key]={slug:result.slug,uploadedAt:new Date().toISOString(),verified:false};await save();
 }
 const slug=receipts[key].slug;
 for(const [f,svg]of Object.entries(files)){const r=await fetch(`${api}/${item.category}/${slug}/${f}`,{signal:AbortSignal.timeout(30000)});if(!r.ok||hash(await r.text())!==hash(svg))throw Error('Uploaded file verification failed: '+key+'/'+f);}
 const remote=await (await fetch(`${api}/${item.category}/${slug}`)).json();if(remote.model!=='GPT-6 Astra'||remote.description!==meta.description)throw Error('Metadata verification failed '+key+': '+JSON.stringify(remote));
 receipts[key].verified=true;receipts[key].sha256=item.sha256;receipts[key].url=`${api}/${item.category}/${slug}`;await save();console.log('uploaded',key,slug);
 await new Promise(r=>setTimeout(r,2300));
}
console.log('DONE',Object.keys(receipts).length);
