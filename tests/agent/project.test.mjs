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
