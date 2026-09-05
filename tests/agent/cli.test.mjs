import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {json,writeJson} from '../../scripts/theater/project.mjs';
const cli=path.resolve('scripts/theater.mjs');
async function invoke(args,cwd=os.tmpdir(),env=process.env) {
 return new Promise((resolve,reject)=>{
  const p=spawn(process.execPath,[cli,...args],{cwd,env,timeout:90000});let stdout='',stderr='';
  p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.on('error',reject);
  p.on('close',(code,signal)=>{try{resolve({code,signal,...JSON.parse(stdout)});}catch{reject(Error(`CLI did not return JSON: ${stdout} ${stderr}`));}});
 });
}
async function project(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'theater cli spaces '));t.after(()=>fs.rm(root,{recursive:true,force:true}));assert.equal((await invoke(['init',root,'--silent'])).ok,true);return root;}

test('CLI rejects misspelled, missing and misplaced options before creating files',async()=>{
 for(const args of [['init','--slient'],['render','--output'],['render','--port','abc'],['render','--port','-1'],['render','--port','65536'],['init','one','two'],['doctor','--silent'],['build','--tts']]) {
  const result=await invoke(args);assert.equal(result.code,1,JSON.stringify(args));assert.equal(result.ok,false,JSON.stringify(args));assert.equal(typeof result.error,'string');
 }
});
test('help documents all commands and init never overwrites an existing project',async t=>{
 const help=await invoke(['help']);assert.equal(help.ok??true,true);assert.match(help.import,/--bundle/);
 const root=await project(t),before=await fs.readFile(path.join(root,'skit.json'));
 const repeat=await invoke(['init',root]);assert.equal(repeat.code,1);assert.match(repeat.error,/empty/);assert.deepEqual(await fs.readFile(path.join(root,'skit.json')),before);
});
test('caption-only bundle round trip remains offline, including characters without voice assignments',async t=>{
 const root=await project(t),skit=await json(path.join(root,'skit.json'));for(const cast of Object.values(skit.cast))delete cast.voice;await writeJson(path.join(root,'skit.json'),skit);
 const build=await invoke(['build',root]);assert.equal(build.ok,true);
 const target=path.join(root,'imported captions');const imported=await invoke(['import',target,'--bundle',build.bundle]);assert.equal(imported.ok,true,imported.error);
 assert.equal((await json(path.join(target,'project.json'))).tts.engine,'none');const rebuilt=await invoke(['build',target]);assert.equal(rebuilt.ok,true,rebuilt.error);assert.equal(rebuilt.generated,0);
});
test('portrait render works from another cwd with spaced output paths and releases its requested port',async t=>{
 const root=await project(t),skit=await json(path.join(root,'skit.json'));skit.stage.orientation='portrait';skit.script=[{do:'say',who:'customer',line:'Testing the tall stage.'},{do:'pause',duration:0.2}];await writeJson(path.join(root,'skit.json'),skit);
 const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const rendered=await invoke(['render',root,'--port',String(port),'--output',path.join(root,'custom render output')]);assert.equal(rendered.ok,true,rendered.error);
 const manifest=await json(rendered.manifest);assert.equal(manifest.orientation,'portrait');assert.deepEqual(manifest.diagnostics,[]);
 const video=manifest.media.streams.find(s=>s.type==='video');assert.equal(video.width,720);assert.equal(video.height,1280);
 await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(port,'127.0.0.1',resolve);});await new Promise(resolve=>probe.close(resolve));
});
test('occupied render port produces a JSON error without disturbing the existing service',async t=>{
 const root=await project(t),server=createServer((req,res)=>res.end('existing service'));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});const port=server.address().port;
 const result=await invoke(['render',root,'--port',String(port)]);assert.equal(result.code,1);assert.match(result.error,/EADDRINUSE/);assert.equal(await(await fetch(`http://127.0.0.1:${port}`)).text(),'existing service');
});
test('missing speech service reports failure, without changing source files',async t=>{
 const root=await project(t);await writeJson(path.join(root,'project.json'),{version:1,tts:{engine:'pocket',endpoint:'http://127.0.0.1:1/tts'}});const before=await fs.readFile(path.join(root,'skit.json'));
 const result=await invoke(['build',root]);assert.equal(result.code,1);assert.equal(result.ok,false);assert.deepEqual(await fs.readFile(path.join(root,'skit.json')),before);
});

test('doctor reports missing system tools with a failing exit code and actionable checks',async t=>{
 const bin=await fs.mkdtemp(path.join(os.tmpdir(),'theater-doctor-bin-'));t.after(()=>fs.rm(bin,{recursive:true,force:true}));
 await fs.symlink(process.execPath,path.join(bin,'node'));
 const result=await invoke(['doctor','--json'],os.tmpdir(),{...process.env,PATH:bin});
 assert.equal(result.code,1);assert.equal(result.ok,false);assert.equal(result.checks.node.ok,true);
 assert.equal(result.checks.ffmpeg.ok,false);assert.match(result.checks.ffmpeg.fix,/Install ffmpeg/);
 assert.equal(result.checks.ffprobe.ok,false);assert.equal(result.speechChecked,false);
});
