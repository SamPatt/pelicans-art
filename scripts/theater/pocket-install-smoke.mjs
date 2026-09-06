// Run only in a disposable CI checkout after setup --tts. Uses real local Pocket.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import assert from 'node:assert/strict';
import {run,json,writeJson,buildProject} from './project.mjs';
import {probeSpeech} from './readiness.mjs';

const root=process.cwd(),cli=path.join(root,'scripts/theater.mjs');
const setup=await json(path.join(root,'.runtime/ci-setup.json'));
assert.equal(setup.ok,true);
const receipt=await json(setup.receipt);
assert.equal(receipt.inspection.architecture,process.arch);
assert.match(receipt.inspection.speechLock.path,/arm64/);
const probe=createServer();await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve);});
const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const args=[...setup.tts.serveCommand];args[args.indexOf('--port')+1]=String(port);
const log=await fs.open(path.join(root,'.runtime/ci-pocket.log'),'w');
const service=spawn(setup.tts.executable,args,{cwd:root,stdio:['ignore',log.fd,log.fd]});
let spawnError;service.on('error',error=>{spawnError=error;});
const exited=new Promise(resolve=>{service.once('close',resolve);});
try {
  const endpoint=`http://127.0.0.1:${port}/tts`;
  const ready=await probeSpeech(endpoint,{waitMs:120000});
  if(spawnError)throw spawnError;
  assert.equal(ready.ok,true,JSON.stringify(ready));
  const health=await fetch(`http://127.0.0.1:${port}/health`).then(r=>r.json());
  assert.equal(health.profile.device,'cpu');assert.equal(health.profile.package,'pocket-tts==2.1.0');
  const project=path.join(root,'.runtime/ci-skit');
  await run(process.execPath,[cli,'init',project]);
  const config=await json(path.join(project,'project.json'));config.tts.endpoint=endpoint;await writeJson(path.join(project,'project.json'),config);
  const first=await buildProject(project);assert.equal(first.generated,3);
  const skit=await json(path.join(project,'skit.json'));
  skit.script.find(b=>b.do==='say').line='I would like to return this invisible bicycle.';
  await writeJson(path.join(project,'skit.json'),skit);
  const revised=await buildProject(project);assert.equal(revised.generated,1);assert.equal(revised.reused,2);
  const rendered=JSON.parse((await run(process.execPath,[cli,'render',project],{timeout:300000})).toString());
  assert.equal(rendered.ok,true);assert.equal(rendered.generated,0);assert.equal(rendered.reused,3);
  await writeJson(path.join(root,'.runtime/ci-speech-result.json'),{ok:true,architecture:process.arch,ready,health,lock:receipt.inspection.speechLock,first,revised,rendered});
  console.log(JSON.stringify({ok:true,architecture:process.arch,generated:first.generated,revised:revised.generated,reused:revised.reused,video:rendered.video}));
} finally {
  service.kill('SIGTERM');const force=setTimeout(()=>service.kill('SIGKILL'),5000);await exited;clearTimeout(force);await log.close();
}
