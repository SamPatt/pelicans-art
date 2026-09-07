import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {searchAssets,addAsset} from '../../scripts/theater/assets.mjs';
async function project(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'asset-import-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));await fs.writeFile(path.join(dir,'skit.json'),JSON.stringify({assets:{},cast:{},script:[]}));return dir;}
test('local discovery searches descriptions and returns bounded categorized preview records',async()=>{
 const result=await searchAssets({source:'local',query:'patience',category:'characters',limit:2});
 assert.ok(result.items.some(item=>item.id==='astra-barista'));const asset=result.items.find(item=>item.id==='astra-barista');assert.equal(asset.model,'GPT-6 Astra');assert.match(asset.previews[0],/^https:\/\/pelicans.art\/sprites\//);
 await assert.rejects(searchAssets({source:'local',category:'../../tmp'}),/category/);
});
test('imports a local prop, preserves provenance, registers keys, and refuses overwrite',async t=>{
 const root=await project(t);const result=await addAsset(root,{source:'local',category:'props',id:'astra-coffee-cup',name:'coffee'});
 assert.equal(result.registered[0].key,'coffee');const meta=JSON.parse(await fs.readFile(result.metadata));assert.equal(meta.model,'GPT-6 Astra');assert.equal(meta.provenance.source,'local');assert.ok(meta.description);assert.equal(meta.files[0].sha256.length,64);
 const skit=JSON.parse(await fs.readFile(path.join(root,'skit.json')));assert.equal(skit.assets.props.coffee,'assets/props-coffee/prop.svg');
 await assert.rejects(addAsset(root,{source:'local',category:'props',id:'astra-coffee-cup',name:'coffee'}),/already exists/);
});
test('imports explicit background orientation and protects project boundaries',async t=>{
 const root=await project(t);const result=await addAsset(root,{source:'local',category:'backgrounds',id:'astra-corner-cafe',name:'cafe',orientation:'landscape'});assert.equal(result.registered[0].key,'cafe');
 await assert.rejects(addAsset(root,{source:'local',category:'props',id:'../escape'}),/safe/);
 const other=await project(t);await fs.symlink(os.tmpdir(),path.join(other,'assets'));await assert.rejects(addAsset(other,{source:'local',category:'props',id:'astra-coffee-cup'}),/symlink/);
});
test('Pouch discovery enriches legacy descriptions and honors pagination bounds',async t=>{
 const prior=globalThis.fetch;t.after(()=>globalThis.fetch=prior);let lists=0;
 globalThis.fetch=async url=>{const u=new URL(url);assert.equal(u.origin,'https://pelicans-community.sam-cloudflare-d20.workers.dev');return new Response(JSON.stringify(u.search?(lists++,{items:[{slug:'old-prop',name:'Old prop'}],hasMore:true,cursor:'next'}):{name:'Old prop',description:'A purple umbrella',tags:['rain']}));};
 const result=await searchAssets({source:'pouch',category:'props',query:'umbrella',maxPages:1});assert.equal(lists,1);assert.equal(result.items[0].description,'A purple umbrella');assert.equal(result.truncated,true);
});
test('Pouch unsafe SVG and unsafe variants never write an import',async t=>{
 const root=await project(t);const prior=globalThis.fetch;t.after(()=>globalThis.fetch=prior);
 globalThis.fetch=async url=>new Response(String(url).endsWith('.svg')?'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>':JSON.stringify({name:'Unsafe'}));
 await assert.rejects(addAsset(root,{source:'pouch',category:'props',id:'unsafe'}),/dangerous/);
 assert.deepEqual(await fs.readdir(root),['skit.json']);
});

test('new portrait-only Pouch summaries point to a portrait preview without detail requests',async t=>{
 const prior=globalThis.fetch;t.after(()=>globalThis.fetch=prior);let requests=0;
 globalThis.fetch=async()=>{requests++;return new Response(JSON.stringify({items:[{slug:'tall-room',key:'backgrounds/tall-room/portrait.svg',name:'Tall room',description:'A narrow hallway',tags:['hall'],searchMetadata:true}],hasMore:false}));};
 const result=await searchAssets({source:'pouch',category:'backgrounds'});assert.equal(requests,1);assert.match(result.items[0].previews[0],/portrait.svg$/);
});

test('discovery excludes empty characters and matches coffee to accented café',async()=>{
 const characters=await searchAssets({source:'local',category:'characters',limit:100});assert.ok(characters.items.every(r=>r.files.includes('front.svg')));
 const cafes=await searchAssets({source:'local',category:'backgrounds',query:'coffee'});assert.ok(cafes.items.some(r=>r.id==='astra-corner-cafe'));
 const portrait=await searchAssets({source:'local',category:'backgrounds',query:'cafe',orientation:'portrait'});assert.ok(!portrait.items.some(r=>r.id==='astra-corner-cafe'));
});
test('explicit project discovery and import preserve usable portrait assets without leaking source paths',async t=>{
 const from=path.resolve('examples/name-for-the-order');const found=await searchAssets({source:'project',project:from,query:'coffee',category:'backgrounds',orientation:'portrait'});assert.equal(found.items[0].id,'cafe');assert.deepEqual(found.items[0].files,['portrait.svg']);
 const root=await project(t);const added=await addAsset(root,{source:'project',project:from,category:'backgrounds',id:'cafe',orientation:'portrait'});assert.match(added.registered[0].path,/portrait.svg$/);const meta=await fs.readFile(added.metadata,'utf8');assert.ok(!meta.includes(from));assert.match(meta,/portrait/);
 await assert.rejects(searchAssets({source:'project'}),/--project/);
 const bad=await project(t);await fs.writeFile(path.join(bad,'skit.json'),JSON.stringify({assets:{props:{outside:'../outside.svg'}}}));await assert.rejects(searchAssets({source:'project',project:bad}));
});

test('Pouch portrait filter checks the actual file instead of guessing from landscape summary',async t=>{
 const prior=globalThis.fetch;t.after(()=>globalThis.fetch=prior);
 globalThis.fetch=async url=>new Response(String(url).endsWith('portrait.svg')?'<svg/>':JSON.stringify({items:[{slug:'both',key:'backgrounds/both/landscape.svg',searchMetadata:true,name:'Both'}],hasMore:false}));
 const found=await searchAssets({source:'pouch',category:'backgrounds',orientation:'portrait'});assert.equal(found.items.length,1);assert.deepEqual(found.items[0].files,['portrait.svg']);
 globalThis.fetch=async url=>String(url).endsWith('portrait.svg')?new Response('',{status:404}):new Response(JSON.stringify({items:[{slug:'wide-only',key:'backgrounds/wide-only/landscape.svg',searchMetadata:true}],hasMore:false}));
 assert.equal((await searchAssets({source:'pouch',category:'backgrounds',orientation:'portrait'})).items.length,0);
});
