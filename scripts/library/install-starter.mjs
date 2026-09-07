// Install reviewed art into the local/runtime library without replacing any
// existing asset. Exact existing copies make this operation resumable.
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('assets/starter-library');
const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json')));
const folders={characters:'sprites',backgrounds:'backgrounds',props:'props'};
for(const item of manifest.items){
 const from=path.join(root,item.category,item.id),to=path.resolve('src',folders[item.category],'starter-'+item.id);
 await fs.mkdir(to,{recursive:true});
 for(const name of [...item.files,'meta.json']){
  const bytes=await fs.readFile(path.join(from,name));const target=path.join(to,name);
  const existing=await fs.readFile(target).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  if(existing&&!existing.equals(bytes))throw Error('Refusing to replace different asset '+target);
  if(!existing)await fs.writeFile(target,bytes,{flag:'wx'});
 }
 item.localId='starter-'+item.id;
 item.localPreview='/'+folders[item.category]+'/'+item.localId+'/'+item.files[0];
}
await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const indexFile=path.resolve('src/sprites/index.json');
const index=JSON.parse(await fs.readFile(indexFile));
index.characters=[...new Set([...index.characters,...manifest.items.filter(i=>i.category==='characters').map(i=>i.localId)])].sort();
await fs.writeFile(indexFile,JSON.stringify(index,null,2)+'\n');
console.log('Installed',manifest.items.length,'local assets');
