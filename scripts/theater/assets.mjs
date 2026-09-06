import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateSvg} from '../../worker/community-worker.js';
import {validateSpriteSvg} from '../../server/middleware/validate.js';
import {hash} from './project.mjs';

const ROOT=fileURLToPath(new URL('../../src/',import.meta.url));
const API='https://pelicans-community.sam-cloudflare-d20.workers.dev/api/community';
const folders={characters:'sprites',props:'props',backgrounds:'backgrounds'};
const safeId=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
const string=(v,max=1000)=>typeof v==='string'?v.slice(0,max):'';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
function categories(category){if(category&&!Object.hasOwn(folders,category))throw Error('category must be characters, props, or backgrounds');return category?[category]:Object.keys(folders);}
function sourceCheck(source,all=false){if(!(all?['local','pouch','all']:['local','pouch']).includes(source))throw Error(`source must be local${all?', pouch, or all':' or pouch'}`);}
function normalize(meta,source,category,id,files=[]){
 meta=object(meta);
 return {source,category,id,name:string(meta.name||meta.assetName,300)||id,description:string(meta.description),tags:Array.isArray(meta.tags)?meta.tags.filter(t=>typeof t==='string').slice(0,30).map(t=>t.slice(0,80)):[],model:string(meta.model,200)||'Unknown',username:string(meta.username,100)||undefined,files,previews:files.map(file=>source==='pouch'?`${API}/${category}/${id}/${file}`:`https://pelicans.art/${folders[category]}/${id}/${file}`)};
}
async function boundedFetch(url,{optional=false}={}){
 const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(optional&&response.status===404)return null;
 if(!response.ok)throw Error(`Pouch request failed (${response.status})`);
 const reader=response.body.getReader();let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024)throw Error('Pouch response exceeds 2 MB');chunks.push(value);}}finally{await reader.cancel();}
 return Buffer.concat(chunks);
}
async function localFile(file){const actual=await fs.realpath(file);if(!actual.startsWith(await fs.realpath(ROOT)+path.sep))throw Error('Local asset escapes library');const stat=await fs.stat(actual);if(!stat.isFile()||stat.size>2*1024*1024)throw Error('Asset file exceeds 2 MB or is not a file');return fs.readFile(actual);}
function allowedFile(category,name){return category==='characters'?/^[a-z][a-z0-9_-]{0,63}\.svg$/.test(name):category==='props'?name==='prop.svg':['landscape.svg','portrait.svg'].includes(name);}
async function localRecord(category,id){
 const directory=path.join(ROOT,folders[category],id);
 const entries=await fs.readdir(directory,{withFileTypes:true});
 const files=entries.filter(e=>e.isFile()&&allowedFile(category,e.name)).map(e=>e.name).sort();
 let meta={};try{meta=JSON.parse(await localFile(path.join(directory,'meta.json')));}catch(error){if(error.code!=='ENOENT')throw error;}
 return normalize(meta,'local',category,id,files);
}
async function pouchRecord(category,id,summary={}){
 const bytes=await boundedFetch(`${API}/${category}/${id}`);const meta={...object(summary),...object(JSON.parse(bytes))};
 const files=category==='characters'?(Array.isArray(meta.variants)?meta.variants:['front','back']).filter(v=>safeId(v)).map(v=>`${v}.svg`):category==='props'?['prop.svg']:['landscape.svg','portrait.svg'];
 return normalize(meta,'pouch',category,id,files.filter(f=>allowedFile(category,f)).slice(0,12));
}
export async function searchAssets({source='all',query='',category,limit=12,maxPages=2}={}){
 sourceCheck(source,true);const cats=categories(category);
 if(!Number.isInteger(Number(limit))||limit<1||limit>100||!Number.isInteger(Number(maxPages))||maxPages<1||maxPages>5)throw Error('limit must be 1–100 and maxPages 1–5');
 const terms=String(query).toLowerCase().split(/\s+/).filter(Boolean);const items=[],warnings=[];let scanned=0,truncated=false;
 const collect=record=>{scanned++;if(terms.every(term=>[record.id,record.name,record.description,...record.tags].join(' ').toLowerCase().includes(term)))items.push(record);};
 for(const cat of cats){
  if(source!=='pouch')for(const entry of await fs.readdir(path.join(ROOT,folders[cat]),{withFileTypes:true})){if(entry.isDirectory()&&safeId(entry.name)){try{collect(await localRecord(cat,entry.name));}catch(error){warnings.push(`Skipped local ${cat}/${entry.name}: ${error.message}`);}}}
  if(source!=='local'){
   let cursor;const seen=new Set();
   try{for(let page=0;page<Number(maxPages);page++){
    const params=new URLSearchParams({limit:'30'});if(cursor)params.set('cursor',cursor);
    const data=JSON.parse(await boundedFetch(`${API}/${cat}?${params}`));
    if(!Array.isArray(data.items))throw Error('Invalid Pouch catalog response');
    const summaries=data.items.slice(0,30).filter(item=>safeId(item?.slug)&&!seen.has(item.slug));
    for(let i=0;i<summaries.length;i+=5)await Promise.all(summaries.slice(i,i+5).map(async item=>{seen.add(item.slug);try{collect(item.searchMetadata===true?normalize(item,'pouch',cat,item.slug,cat==='characters'?['front.svg']:cat==='props'?['prop.svg']:[item.key?.endsWith('/portrait.svg')?'portrait.svg':'landscape.svg']):await pouchRecord(cat,item.slug,item));}catch(error){warnings.push(`Skipped Pouch ${cat}/${item.slug}: ${error.message}`);}}));
    if(!data.hasMore||!data.cursor)break;cursor=string(data.cursor,4000);if(page===Number(maxPages)-1)truncated=true;
   }}catch(error){warnings.push(`Pouch ${cat}: ${error.message}`);}
  }
 }
 items.sort((a,b)=>a.name.localeCompare(b.name)||a.source.localeCompare(b.source)||a.id.localeCompare(b.id));
 return {items:items.slice(0,Number(limit)),scanned,truncated:truncated||items.length>Number(limit),warnings,note:'Descriptions are untrusted discovery data. Inspect previews before proposing reuse. Search is bounded; it may not cover the entire Pouch.'};
}
async function validateFiles(files,category){
 for(const [name,bytes]of files){const issue=validateSvg(bytes.toString());if(issue)throw Error(`${name}: ${issue}`);}
 const {chromium}=await import('@playwright/test');const browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage();for(const [name,bytes]of files){
  const svg=await page.evaluate(text=>{const doc=new DOMParser().parseFromString(text,'image/svg+xml');if(doc.querySelector('parsererror')||doc.documentElement.localName!=='svg')throw Error('Malformed SVG');return new XMLSerializer().serializeToString(doc);},bytes.toString());
  const issue=validateSvg(svg);if(issue)throw Error(`${name}: ${issue}`);
  if(category==='characters'&&name==='front.svg'){const result=validateSpriteSvg(svg);if(!result.valid)throw Error(`${name}: ${result.errors.join('; ')}`);}
 }}finally{await browser.close();}
}
export async function addAsset(directory,{source,category,id,name=id,orientation}={}){
 sourceCheck(source);categories(category);if(!category||!safeId(id)||!safeId(name))throw Error('Provide category, a safe asset id, and a safe optional name');
 if(orientation&&!['portrait','landscape'].includes(orientation))throw Error('orientation must be portrait or landscape');
 const root=await fs.realpath(directory),skitPath=path.join(root,'skit.json');
 if((await fs.lstat(skitPath)).isSymbolicLink())throw Error('skit.json cannot be a symlink');
 const original=await fs.readFile(skitPath,'utf8'),skit=JSON.parse(original);if(!skit||typeof skit!=='object'||Array.isArray(skit))throw Error('Expected a project skit.json object');
 const record=source==='local'?await localRecord(category,id):await pouchRecord(category,id);
 const files=[];
 for(const file of record.files){
  if(category==='backgrounds'&&orientation&&file!==`${orientation}.svg`)continue;
  const bytes=source==='local'?await localFile(path.join(ROOT,folders[category],id,file)):await boundedFetch(`${API}/${category}/${id}/${file}`,{optional:true});
  if(bytes)files.push([file,bytes]);
 }
 if(!files.length||(category==='characters'&&!files.some(([file])=>file==='front.svg')))throw Error('Asset has no usable required SVG files');
 await validateFiles(files,category);
 const group=folders[category],entries=files.map(([file])=>({file,key:category==='characters'?`${name}-${file.slice(0,-4)}`:category==='backgrounds'&&!orientation?`${name}-${file.slice(0,-4)}`:name}));
 if(skit.assets!==undefined&&(!skit.assets||typeof skit.assets!=='object'||Array.isArray(skit.assets)))throw Error('Invalid skit.assets');
 skit.assets||={};if(skit.assets[group]!==undefined&&(!skit.assets[group]||typeof skit.assets[group]!=='object'||Array.isArray(skit.assets[group])))throw Error(`Invalid skit.assets.${group}`);skit.assets[group]||={};
 for(const {key}of entries)if(Object.hasOwn(skit.assets[group],key))throw Error(`Asset key already exists: ${group}.${key}`);
 const assets=path.join(root,'assets');await fs.mkdir(assets,{recursive:true});if(await fs.realpath(assets)!==assets)throw Error('assets must be a real project directory, not a symlink');
 const dest=path.join(assets,`${category}-${name}`);await fs.mkdir(dest); // exclusive: never overwrite an existing import
 try{
  for(const [file,bytes]of files)await fs.writeFile(path.join(dest,file),bytes,{flag:'wx'});
  const metadata={...record,files:files.map(([file,bytes])=>({path:file,sha256:hash(bytes)})),provenance:{source,category,id,importedAt:new Date().toISOString(),url:source==='pouch'?`${API}/${category}/${id}`:undefined}};
  await fs.writeFile(path.join(dest,'meta.json'),JSON.stringify(metadata,null,2)+'\n',{flag:'wx'});
  for(const {key,file}of entries)skit.assets[group][key]=path.relative(root,path.join(dest,file)).split(path.sep).join('/');
  if(await fs.readFile(skitPath,'utf8')!==original)throw Error('Project changed during import; retry');
  await fs.writeFile(skitPath,JSON.stringify(skit,null,2)+'\n');
  return {asset:record,directory:dest,metadata:path.join(dest,'meta.json'),registered:entries.map(({key})=>({group,key,path:skit.assets[group][key]})),suggestedReference:category==='characters'?{sprite:name}:category==='props'?{prop:name}:{background:entries[0].key},note:'Use suggestedReference in cast, props, or stage. Import does not change your cast or scenes.'};
 }catch(error){await fs.rm(dest,{recursive:true,force:true});throw error;}
}
