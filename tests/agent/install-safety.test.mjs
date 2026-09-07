import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {checkDirectories,checkPlatform,checkVenv,preflight,pocketLocks,macPocketLock,speechLockPath} from '../../scripts/theater/install-safety.mjs';
import {run} from '../../scripts/theater/project.mjs';

test('unsupported local speech platforms fail before installation',()=>{
  for (const config of [{platform:'darwin',arch:'x64'},{platform:'linux',arch:'riscv64'},{platform:'linux',arch:'x64',glibc:'2.17'},{platform:'win32',arch:'x64'}]) assert.throws(()=>checkPlatform({...config,tts:true}));
  checkPlatform({platform:'linux',arch:'x64',glibc:'2.28',tts:true});
  checkPlatform({platform:'darwin',arch:'arm64',tts:false});
  checkPlatform({platform:'darwin',arch:'arm64',tts:true});
  assert.equal(speechLockPath('darwin','arm64'),macPocketLock);
  assert.equal(speechLockPath('darwin','x64'),undefined);
  checkPlatform({platform:'linux',arch:'arm64',glibc:'2.39',tts:true});
  assert.throws(()=>checkPlatform({platform:'linux',arch:'arm64',glibc:'2.27',tts:true}));
  assert.notEqual(pocketLocks.arm64,pocketLocks.x64);
});
test('redirected dependency directories are rejected without touching their targets',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'theater-safety-'));
  try {
    await fs.mkdir(path.join(root,'external')); await fs.writeFile(path.join(root,'external/keep'),'unchanged');
    await fs.symlink(path.join(root,'external'),path.join(root,'.runtime'));
    await assert.rejects(checkDirectories(root,['.runtime/pocket-tts-2.1.0']),/real directory/);
    assert.equal(await fs.readFile(path.join(root,'external/keep'),'utf8'),'unchanged');
  } finally {await fs.rm(root,{recursive:true,force:true});}
});
test('a real venv with its normal interpreter symlink is accepted; system-site access is rejected',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'theater-venv-'));
  try {
    const env=path.join(root,'env');
    await run('python3.12',['-m','venv','--without-pip',env]);
    assert.equal(await checkVenv(env,run),true);
    const file=path.join(env,'pyvenv.cfg');
    await fs.writeFile(file,(await fs.readFile(file,'utf8')).replace('include-system-site-packages = false','include-system-site-packages = true'));
    await assert.rejects(checkVenv(env,run),/isolated/);
  } finally {await fs.rm(root,{recursive:true,force:true});}
});
test('an executable outside a venv cannot masquerade as an existing speech environment',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'theater-fake-env-'));
  try {
    await fs.mkdir(path.join(root,'bin')); await fs.symlink('/usr/bin/python3',path.join(root,'bin/python'));
    await fs.writeFile(path.join(root,'pyvenv.cfg'),'include-system-site-packages = false\n');
    await assert.rejects(checkVenv(root,async()=>Buffer.from(JSON.stringify({prefix:'/usr',base:'/usr',version:[3,12]}))),/isolated/);
  } finally {await fs.rm(root,{recursive:true,force:true});}
});
test('preflight failures never invoke installation or create directories',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'theater-preflight-'));
  const calls=[];
  try {
    await assert.rejects(preflight(root,{tts:true,python:'incompatible-python',run:async(command,args)=>{
      calls.push([command,args]);
      return Buffer.from(command==='incompatible-python'?'[3, 9]':'version');
    }}),/Python 3.12/);
    assert.deepEqual(await fs.readdir(root),[]);
    assert.ok(calls.every(([,args])=>!args.includes('install')&&!args.includes('ci')));
  } finally {await fs.rm(root,{recursive:true,force:true});}
});

test('both architecture locks preserve the pinned package versions and hashes',async()=>{
  const locks=await Promise.all(Object.values(pocketLocks).map(p=>fs.readFile(p,'utf8')));
  const versions=s=>s.match(/^[a-zA-Z0-9_-]+==[^\\\s]+/gm).sort();
  assert.deepEqual(versions(locks[0]),versions(locks[1]));
  for(const lock of locks) {
    assert.match(lock,/^pocket-tts==2\.1\.0 /m);
    assert.match(lock,/^torch==2\.8\.0\+cpu /m);
    for(const entry of lock.replace(/^#.*\n/gm,'').trim().split(/\n(?=[a-zA-Z])/))assert.match(entry,/--hash=sha256:[a-f0-9]{64}/);
  }
});

test('installation progress can stream without mixing stderr into returned JSON',async()=>{
  const progress=[];
  const result=await run(process.execPath,['-e',`process.stdout.write(JSON.stringify({ok:true}));process.stderr.write('Downloading dependency');`],{onOutput:chunk=>progress.push(chunk.toString())});
  assert.deepEqual(JSON.parse(result.toString()),{ok:true});
  assert.ok(progress.join('').includes('Downloading dependency'));
  await assert.rejects(run(process.execPath,['-e',`process.stderr.write('Installation failed');process.exit(1);`],{onOutput:chunk=>progress.push(chunk.toString())}),/Installation failed/);
  assert.ok(progress.join('').includes('Installation failed'));
});

test('a missing optional executable never leaves a long timeout holding the CLI open',async()=>{
  const moduleUrl=new URL('../../scripts/theater/project.mjs',import.meta.url).href;
  const result=await run(process.execPath,['--input-type=module','-e',`import {run} from ${JSON.stringify(moduleUrl)}; await run('pelican-nonexistent-executable',[],{timeout:1200000}).catch(()=>{}); console.log('done');`],{timeout:3000});
  assert.equal(result.toString().trim(),'done');
  await assert.rejects(run(process.execPath,['-e','setInterval(()=>{},1000)'],{timeout:50}),/timed out/);
});

test('Apple Silicon lock uses the pinned macOS CPU-capable Torch wheel',async()=>{
 const lock=await fs.readFile(macPocketLock,'utf8');
 assert.match(lock,/^torch==2\.8\.0 /m);
 assert.match(lock,/^pocket-tts==2\.1\.0 /m);
 assert.ok(!lock.includes('+cpu'));
 for(const entry of lock.replace(/^#.*\n/gm,'').trim().split(/\n(?=[a-zA-Z])/))assert.match(entry,/--hash=sha256:[a-f0-9]{64}/);
});
