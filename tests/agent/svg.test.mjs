import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {hash} from '../../scripts/theater/project.mjs';
import {preflight} from '../../scripts/theater/install-safety.mjs';
const cli=path.resolve('scripts/theater.mjs');
function invoke(args){return new Promise((resolve,reject)=>{
 const p=spawn(process.execPath,[cli,...args],{cwd:os.tmpdir(),timeout:45000});let out='',err='';
 p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.on('error',reject);p.on('close',code=>{try{resolve({code,...JSON.parse(out)});}catch{reject(Error(out+err));}});
});}
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'svg delivery '));t.after(()=>fs.rm(root,{recursive:true,force:true}));return root;}
const art='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="200" height="100" fill="#f8e7bd"/><circle cx="100" cy="50" r="35" fill="#19616b"/></svg>';
test('standalone SVG delivers original artwork, correctly sized PNG and portable metadata without a skit',async t=>{
 const root=await fixture(t),source=path.join(root,'drawing.svg'),dest=path.join(root,'first version');await fs.writeFile(source,art);
 const result=await invoke(['svg',dest,'--source',source,'--model','GPT-6 Astra','--title','A round audition','--description','A teal circle on cream.','--tags','abstract,teal','--author','Test artist']);assert.equal(result.code,0,result.error);
 assert.equal(await fs.readFile(result.svg,'utf8'),art);
 const png=await fs.readFile(result.preview);assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1024);assert.equal(png.readUInt32BE(20),512);
 const m=JSON.parse(await fs.readFile(result.manifest));assert.equal(m.model,'GPT-6 Astra');assert.equal(m.description,'A teal circle on cream.');assert.deepEqual(m.tags,['abstract','teal']);assert.equal(m.category,'artwork');const meta=JSON.parse(await fs.readFile(result.meta));assert.equal(meta.author,'Test artist');assert.equal(meta.name,m.title);assert.equal(m.kind,'artwork');assert.equal(m.files[0].sha256,hash(Buffer.from(art)));assert.equal(m.files[1].sha256,hash(png));assert.ok(m.files.every(f=>!path.isAbsolute(f.path)));assert.deepEqual((await fs.readdir(dest)).sort(),['asset.svg','manifest.json','meta.json','preview.png']);
 const repeat=await invoke(['svg',dest,'--source',source]);assert.equal(repeat.code,1);assert.equal(await fs.readFile(result.svg,'utf8'),art);
});
test('invalid, executable, external and malformed artwork does not create a delivery',async t=>{
 const root=await fixture(t),source=path.join(root,'drawing.svg'),dest=path.join(root,'out');
 for(const bad of [art.replace('<circle','<script>alert(1)</script><circle'),art.replace('<circle','<image href="https://example.com/a.png"/><circle'),art.replace('</svg>',''),art.replace('200 100','0 100'),art.replace('<circle','<set attributeName="href" to="https://example.com"/><circle'),art.replace('<circle','<s:script xmlns:s="http://www.w3.org/2000/svg"/><circle')]) {
  await fs.writeFile(source,bad);const r=await invoke(['svg',dest,'--source',source]);assert.equal(r.code,1,JSON.stringify(r));assert.equal(await fs.stat(dest).then(()=>true).catch(()=>false),false);
 }
});
test('theater characters require animation structure while ordinary artwork does not',async t=>{
 const root=await fixture(t),source=path.join(root,'drawing.svg');await fs.writeFile(source,art);
 const result=await invoke(['svg',path.join(root,'out'),'--source',source,'--kind','character']);assert.equal(result.code,1);assert.match(result.error,/body/);
 const project=path.join(root,'source');assert.equal((await invoke(['init',project,'--silent'])).code,0);
 const character=await invoke(['svg',path.join(root,'character'),'--source',path.join(project,'assets/pelican.svg'),'--kind','character']);assert.equal(character.code,0,character.error);assert.equal(character.model,'Unknown');
});
test('SVG setup preflight needs neither FFmpeg nor Python and rejects mixed setup modes',async t=>{
 const root=await fixture(t),calls=[];
 await preflight(root,{tts:false,svgOnly:true,run:async command=>{calls.push(command);if(command!=='npm')throw Error('unexpected dependency');return Buffer.from('10');}});
 assert.deepEqual(calls,['npm']);assert.deepEqual(await fs.readdir(root),[]);
 for(const args of [['setup','--svg','--tts'],['setup','--svg','--python','python3.12'],['svg','--source','drawing.svg']])assert.equal((await invoke(args)).code,1);
});
test('missing search metadata uses SVG title and description without invented appearance claims',async t=>{
 const root=await fixture(t),source=path.join(root,'drawing.svg');
 await fs.writeFile(source,art.replace('><rect','><title>Blue &amp; round</title><desc>A plain circle.</desc><rect'));
 const r=await invoke(['svg',path.join(root,'out'),'--source',source]);assert.equal(r.code,0,r.error);
 assert.equal(r.title,'Blue & round');assert.equal(r.description,'A plain circle.');assert.deepEqual(r.tags,[]);
});
