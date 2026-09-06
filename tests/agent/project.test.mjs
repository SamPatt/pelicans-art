import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { run, json, writeJson, loadProject, buildProject } from '../../scripts/theater/project.mjs';
const cli = path.resolve('scripts/theater.mjs');
async function fixture(t) { const root=await fs.mkdtemp(path.join(os.tmpdir(),'theater-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));await run(process.execPath,[cli,'init',root]);return root; }
function wav() {const b=Buffer.alloc(44+3200);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(3200,40);return b;}
test('validation rejects executable SVG, unknown actions, missing assets, and escaped paths',async t=>{
 const root=await fixture(t), original=await json(path.join(root,'skit.json'));
 for(const change of [s=>s.script.push({do:'invented'}),s=>s.cast.customer.sprite='missing',s=>s.assets.sprites['pelican-front']='../escape.svg']) {
   const s=structuredClone(original);change(s);await writeJson(path.join(root,'skit.json'),s);await assert.rejects(loadProject(root));
 }
 await writeJson(path.join(root,'skit.json'),original);await fs.appendFile(path.join(root,'assets/pelican.svg'),'<script>alert(1)</script>');await assert.rejects(loadProject(root),/dangerous/);
});
test('build caches unchanged speech, invalidates only an edited line, and imports recordings',async t=>{
 const root=await fixture(t);let requests=0;
 const server=createServer((req,res)=>{requests++;req.resume();res.setHeader('Content-Type','audio/wav');res.end(wav());});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});
 await writeJson(path.join(root,'project.json'),{version:1,tts:{engine:'pocket',endpoint:`http://127.0.0.1:${server.address().port}/tts`,model:'test'}});
 assert.equal((await buildProject(root)).generated,3);assert.equal(requests,3);
 let s=await json(path.join(root,'skit.json'));s.script[1].line='A new line.';await writeJson(path.join(root,'skit.json'),s);
 const revised=await buildProject(root);assert.equal(revised.generated,1);assert.equal(revised.reused,2);assert.equal(requests,4);
 s.script[2].duration=2;await writeJson(path.join(root,'skit.json'),s);assert.equal((await buildProject(root)).reused,3);assert.equal(requests,4);
 const imported=path.join(root,'imported');await run(process.execPath,[cli,'import',imported,'--bundle',revised.bundle]);
 assert.equal((await buildProject(imported)).generated,0);assert.equal(requests,4);
 const bundle=await json(revised.bundle);assert.equal(Object.keys(bundle.assets.audio).length,3);assert.equal(bundle.meta.model,'Unknown');
});
test('bad speech fails a voiced build without a success bundle',async t=>{
 const root=await fixture(t), server=createServer((req,res)=>{req.resume();res.end('not audio');});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});
 await writeJson(path.join(root,'project.json'),{version:1,tts:{engine:'pocket',endpoint:`http://127.0.0.1:${server.address().port}`,model:'test'}});
 await assert.rejects(buildProject(root));await assert.rejects(fs.access(path.join(root,'output/project.json')));
});
test('explicit caption-only render produces a complete MP4 without TTS',async t=>{
 const root=await fixture(t);await writeJson(path.join(root,'project.json'),{version:1,tts:{engine:'none'}});
 const result=JSON.parse((await run(process.execPath,[cli,'render',root])).toString());
 assert.equal(result.ok,true);const manifest=await json(result.manifest);
 assert.equal(manifest.captionOnly,true);assert.equal(manifest.audioLinesMuxed,0);assert.deepEqual(manifest.diagnostics,[]);
 assert.equal(manifest.media.streams.find(s=>s.type==='video').codec,'h264');
});

async function speechServer(t, handler) {
 const server=createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>{server.closeAllConnections();server.close();});return `http://127.0.0.1:${server.address().port}/tts`;
}
async function config(root,endpoint,extra={}) {await writeJson(path.join(root,'project.json'),{version:1,tts:{engine:'pocket',endpoint,model:'test',...extra}});}

test('real outside files and symlinks cannot escape the project; malformed actions explain the error',async t=>{
 const root=await fixture(t), outside=await fs.mkdtemp(path.join(os.tmpdir(),'theater-outside-'));t.after(()=>fs.rm(outside,{recursive:true,force:true}));
 await fs.copyFile(path.join(root,'assets/pelican.svg'),path.join(outside,'pelican.svg'));
 await fs.symlink(path.join(outside,'pelican.svg'),path.join(root,'assets/link.svg'));
 const original=await json(path.join(root,'skit.json'));
 for (const source of [path.relative(root,path.join(outside,'pelican.svg')),'assets/link.svg']) {
  const skit=structuredClone(original);skit.assets.sprites['pelican-front']=source;await writeJson(path.join(root,'skit.json'),skit);
  await assert.rejects(loadProject(root),/escapes project directory/);
 }
 for(const script of [null,{},[null]]) {await writeJson(path.join(root,'skit.json'),{...original,script});await assert.rejects(loadProject(root),/script must be an array of action objects/);}
});

test('failed import leaves an empty directory and can be retried with a valid bundle',async t=>{
 const root=await fixture(t);await config(root,'',{engine:'none'});const built=await buildProject(root), bundle=await json(built.bundle);
 const target=path.join(root,'retry'), bad=path.join(root,'bad.json');await writeJson(bad,{...bundle,script:[null]});
 await assert.rejects(run(process.execPath,[cli,'import',target,'--bundle',bad]),/script must be an array/);
 assert.deepEqual(await fs.readdir(target),[]);
 await run(process.execPath,[cli,'import',target,'--bundle',built.bundle]);assert.equal((await loadProject(target)).skit.meta.title,bundle.meta.title);
 await assert.rejects(run(process.execPath,[cli,'import',target,'--bundle',built.bundle]),/empty directory/);
 await assert.rejects(run(process.execPath,[cli,'import',target]),/requires --bundle/);
});

test('partial speech failure recovers from cache; corrupt cache regenerates only its line',async t=>{
 const root=await fixture(t);let count=0,fail=true;
 const endpoint=await speechServer(t,(req,res)=>{req.resume();count++;if(fail&&count===2){res.writeHead(503);res.end();}else res.end(wav());});await config(root,endpoint);
 await assert.rejects(buildProject(root),/503/);await assert.rejects(fs.access(path.join(root,'output/project.json')));
 fail=false;const recovered=await buildProject(root);assert.equal(recovered.generated,2);assert.equal(recovered.reused,1);assert.equal(count,4);
 await fs.writeFile(path.join(root,'.cache',recovered.lines[1].cacheKey+'.mp3'),'broken');
 const repaired=await buildProject(root);assert.equal(repaired.generated,1);assert.equal(repaired.reused,2);assert.equal(count,5);
});

test('imported dialogue edits and recasting regenerate only affected recordings',async t=>{
 const root=await fixture(t);let count=0;const endpoint=await speechServer(t,(req,res)=>{count++;req.resume();res.end(wav());});await config(root,endpoint);
 const built=await buildProject(root), target=path.join(root,'revision');await run(process.execPath,[cli,'import',target,'--bundle',built.bundle]);await config(target,endpoint);
 let skit=await json(path.join(target,'skit.json'));skit.script[1].line='Please refund the pedals.';await writeJson(path.join(target,'skit.json'),skit);
 let result=await buildProject(target);assert.equal(result.generated,1);assert.equal(result.lines.filter(l=>l.source==='supplied').length,2);
 skit.cast.clerk.voice='jean';await writeJson(path.join(target,'skit.json'),skit);result=await buildProject(target);
 assert.equal(result.generated,1);assert.equal(result.reused,1);assert.equal(result.lines.filter(l=>l.source==='supplied').length,1);assert.equal(count,5);
});

test('speech adapters send expected voice/text and credentials; redirects cannot forward credentials',async t=>{
 const {synthesize}=await import('../../scripts/theater/project.mjs');const seen=[];
 const endpoint=await speechServer(t,async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;seen.push({headers:req.headers,body});res.end(wav());});
 process.env.THEATER_TEST_TOKEN='test-only-token';t.after(()=>delete process.env.THEATER_TEST_TOKEN);
 await synthesize({engine:'openai-compatible',endpoint,model:'local-model',tokenEnv:'THEATER_TEST_TOKEN',speed:1.2},'Hello','alba');
 assert.equal(seen[0].headers.authorization,'Bearer test-only-token');assert.deepEqual(JSON.parse(seen[0].body),{input:'Hello',voice:'alba',model:'local-model',response_format:'wav',speed:1.2});
 await synthesize({engine:'piper',endpoint},'Hi','test-voice');assert.deepEqual(JSON.parse(seen[1].body),{text:'Hi',voice:'test-voice',rate:16000,depth:16,format:'linear'});
 const redirect=await speechServer(t,(req,res)=>{req.resume();res.writeHead(307,{Location:endpoint});res.end();});
 await assert.rejects(synthesize({engine:'openai-compatible',endpoint:redirect,tokenEnv:'THEATER_TEST_TOKEN'},'Secret','alba'));assert.equal(seen.length,2);
 await assert.rejects(synthesize({engine:'pocket',endpoint,tokenEnv:'THEATER_MISSING_TEST_TOKEN'},'Hi','alba'),/Missing credential/);
});

test('voiced CLI render imports a full production with props and variants and muxes every line',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'theater-production-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await run(process.execPath,[cli,'import',root,'--bundle',path.resolve('src/published/theDescription.json')]);
 const result=JSON.parse((await run(process.execPath,[cli,'render',root])).toString());const manifest=await json(result.manifest);
 assert.equal(result.ok,true);assert.equal(result.generated,0);assert.equal(manifest.audioLinesMuxed,8);assert.deepEqual(manifest.diagnostics,[]);
 assert.equal(manifest.media.streams.find(s=>s.type==='video').codec,'h264');assert.equal(manifest.media.streams.find(s=>s.type==='audio').codec,'aac');
});

test('supplied WAV works without a voice service; stale imported text requires a voice before synthesis',async t=>{
 const root=await fixture(t),skit=await json(path.join(root,'skit.json'));skit.script=[{do:'say',who:'customer',line:'Recorded dialogue.'}];delete skit.cast.customer.voice;
 await fs.writeFile(path.join(root,'assets/recording.wav'),wav());skit.assets.audio={'line-0':'assets/recording.wav'};skit.audioBindings={'line-0':{who:'customer',line:'Recorded dialogue.'}};await writeJson(path.join(root,'skit.json'),skit);
 const result=await buildProject(root);assert.equal(result.generated,0);assert.equal(result.lines[0].source,'supplied');
 skit.script[0].line='New unrecorded words.';await writeJson(path.join(root,'skit.json'),skit);await assert.rejects(loadProject(root),/assign voice or supply audio/);
});

test('changing the speech model invalidates the cache even when text and voices are unchanged',async t=>{
 const root=await fixture(t);let count=0;const endpoint=await speechServer(t,(req,res)=>{count++;req.resume();res.end(wav());});await config(root,endpoint);
 assert.equal((await buildProject(root)).generated,3);await config(root,endpoint,{model:'new-model'});assert.equal((await buildProject(root)).generated,3);assert.equal(count,6);
 assert.equal((await buildProject(root)).reused,3);assert.equal(count,6);
});

test('saved build manifest resolves after moving delivery files while CLI paths stay absolute',async t=>{
 const root=await fixture(t);await config(root,'',{engine:'none'});const result=await buildProject(root);
 assert.ok(path.isAbsolute(result.bundle));const manifest=await json(path.join(root,'output/build-manifest.json'));
 assert.equal(manifest.bundle,'output/project.json');assert.equal(manifest.pathBase,'project');assert.ok(!JSON.stringify(manifest).includes(root));
 const delivery=await fs.mkdtemp(path.join(os.tmpdir(),'theater-relocated-'));t.after(()=>fs.rm(delivery,{recursive:true,force:true}));await fs.cp(path.join(root,'output'),path.join(delivery,'output'),{recursive:true});
 const moved=await json(path.join(delivery,'output/build-manifest.json'));assert.equal((await json(path.resolve(delivery,moved.bundle))).meta.title,'The Return');
});
