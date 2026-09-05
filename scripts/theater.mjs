#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { json, writeJson, run, loadProject, buildProject, synthesize } from './theater/project.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(import.meta.url);
const args = process.argv.slice(2), command = args.shift();
const flags = new Map(), positionals = [];
for (let i=0;i<args.length;i++) { if(args[i].startsWith('--')) { const key=args[i].slice(2); flags.set(key,['json','tts','silent','help'].includes(key)?true:args[++i]); } else positionals.push(args[i]); }
const directory = path.resolve(positionals[0] || 'data/projects/my-skit');
const report = value => process.stdout.write(JSON.stringify(value,null,2)+'\n');
async function doctor() {
  const checks = {};
  for (const [name, argv] of Object.entries({node:['--version'],npm:['--version'],python3:['--version'],ffmpeg:['-version'],ffprobe:['-version']})) {
    try { checks[name]={ok:true,version:(await run(name,argv)).toString().split('\n')[0]}; } catch { checks[name]={ok:false,fix:`Install ${name}${name==='node'?' 22 or later':''}`}; }
  }
  checks.node.ok = Number(process.versions.node.split('.')[0]) >= 22;
  try { const {chromium}=require('@playwright/test'); const browser=await chromium.launch({headless:true}); await browser.close(); checks.chromium={ok:true}; }
  catch { checks.chromium={ok:false,fix:'Run npm run theater -- setup; Linux may also need npx playwright install-deps chromium'}; }
  if (flags.has('endpoint')) {
    try { await synthesize({engine:'pocket',endpoint:flags.get('endpoint')},'The theater is ready.','alba'); checks.speech={ok:true}; }
    catch(error){ checks.speech={ok:false,message:error.message}; }
  }
  const ok=Object.values(checks).every(c=>c.ok); report({ok,checks,speechChecked:flags.has('endpoint')}); if(!ok)process.exitCode=1;
}
async function setup() {
  console.error('Installing locked theater dependencies…');
  await run('npm',['ci'],{cwd:ROOT}); await run('npm',['--prefix','server','ci'],{cwd:ROOT});
  console.error('Installing Chromium…');
  await run('npx',['playwright','install','chromium'],{cwd:ROOT});
  let tts;
  if (flags.has('tts')) {
    const env=path.join(ROOT,'.runtime/pocket-tts'), python=path.join(env,'bin/python');
    const basePython = flags.get('python') || 'python3';
    const version = JSON.parse((await run(basePython,['-c','import sys,json;print(json.dumps(list(sys.version_info[:2])))'])).toString());
    if(version[0]!==3 || version[1]<10 || version[1]>13) throw new Error('Pocket installer requires Python 3.10–3.13; specify --python python3.12');
    console.error('Installing isolated CPU speech runtime (first install downloads model dependencies)…');
    await fs.mkdir(path.dirname(env),{recursive:true});
    const hasUv = await run('uv',['--version']).then(()=>true).catch(()=>false);
    if (hasUv) {
      try {await fs.access(python);} catch {await run('uv',['venv',env,'--python',basePython]);}
    } else {
      try {await run(python,['-m','pip','--version']);} catch {await run(basePython,['-m','venv',env]);}
    }
    const install = async packages => hasUv
      ? run('uv',['pip','install','--python',python,...packages])
      : run(python,['-m','pip','install',...packages]);
    await install(['torch==2.8.0',...(process.platform==='linux'?['--index-url','https://download.pytorch.org/whl/cpu']:[])]);
    await install(['pocket-tts==1.0.3']);
    tts={version:'1.0.3',command:`${path.join(env,'bin/pocket-tts')} serve --host 127.0.0.1 --port 8001`};
  }
  report({ok:true,tts,message:'Dependencies installed. Run doctor with --endpoint to verify speech; TTS is not started automatically.'});
}
async function init() {
  await fs.mkdir(directory,{recursive:true});
  const entries=await fs.readdir(directory); if(entries.length)throw new Error('Choose an empty project directory; existing work is never overwritten by init.');
  await fs.mkdir(path.join(directory,'assets'));
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150"><g id="body"><ellipse cx="48" cy="100" rx="27" ry="34" fill="#fff7df" stroke="#193b40" stroke-width="2"/><path d="M35 126v15h-14m38-15v15h15" fill="none" stroke="#efac35" stroke-width="5"/></g><g id="head-top"><path d="M32 76V38Q35 18 50 21Q72 24 68 46L64 77" fill="#fff7df" stroke="#193b40" stroke-width="2"/><ellipse id="eye-left-white" cx="44" cy="40" rx="6" ry="8" fill="white"/><ellipse id="eye-right-white" cx="59" cy="40" rx="6" ry="8" fill="white"/><circle id="eye-left-pupil" class="pupil" cx="46" cy="41" r="3" fill="#193b40"/><circle id="eye-right-pupil" class="pupil" cx="61" cy="41" r="3" fill="#193b40"/><path id="brow-left" d="M39 29h10" stroke="#193b40"/><path id="brow-right" d="M55 29h10" stroke="#193b40"/></g><g id="head-bottom"><path d="M47 51h48L53 68Z" fill="#efac35" stroke="#193b40"/><path id="mouth-closed" d="M49 55h37" stroke="#193b40"/><ellipse id="mouth-open" cx="61" cy="55" rx="10" ry="4" fill="#193b40" opacity="0"/></g></svg>`;
  await fs.writeFile(path.join(directory,'assets/pelican.svg'),svg);
  await fs.writeFile(path.join(directory,'assets/harbor.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><path fill="#f8e7bd" d="M0 0h1280v720H0z"/><path fill="#83b4b0" d="M0 300h1280v200H0z"/><path fill="#d8c39b" d="M0 500h1280v220H0z"/></svg>');
  await writeJson(path.join(directory,'project.json'),{version:1,tts:{engine:flags.has('silent')?'none':'pocket',endpoint:'http://127.0.0.1:8001/tts',model:'pocket-tts-1.0.3'}});
  await writeJson(path.join(directory,'skit.json'),{meta:{title:'The Return',model:'Unknown'},stage:{background:'harbor',orientation:'landscape'},cast:{customer:{sprite:'pelican',x:30,voice:'marius'},clerk:{sprite:'pelican',x:70,voice:'alba'}},script:[{do:'shot',type:'wide'},{do:'say',who:'customer',line:'I would like to return this bicycle.'},{do:'pause',duration:0.5},{do:'say',who:'clerk',line:'You came on foot.'},{do:'pause',duration:0.7},{do:'say',who:'customer',line:'Exactly. It has abandoned me.'},{do:'pause',duration:1}],assets:{sprites:{'pelican-front':'assets/pelican.svg'},spriteMeta:{pelican:{name:'Pelican',model:'Unknown'}},backgrounds:{harbor:'assets/harbor.svg'},props:{},audio:{}}});
  report({ok:true,project:directory,next:'Edit skit.json and assets, then validate, build, render.'});
}
async function importBundle() {
  if (!flags.get('bundle')) throw new Error('import requires --bundle /path/to/project.json');
  const bundle = await json(path.resolve(flags.get('bundle')));
  if (!bundle.assets || !Array.isArray(bundle.script) || !bundle.cast) throw new Error('Expected a built skit bundle');
  await fs.mkdir(directory, {recursive:true});
  if ((await fs.readdir(directory)).length) throw new Error('Import requires an empty directory');
  // Validate in a staging directory; failed imports leave the destination empty for retry.
  const staging = await fs.mkdtemp(path.join(directory, '.import-'));
  try {
    bundle.audioBindings = Object.fromEntries(bundle.script.filter(b=>b?.do==='say').map((b,i)=>[`line-${i}`,{line:b.line,who:b.who,voice:bundle.cast[b.who]?.voice}]));
    await writeJson(path.join(staging,'skit.json'),bundle);
    await writeJson(path.join(staging,'project.json'),{version:1,tts:{engine:'pocket',endpoint:'http://127.0.0.1:8001/tts',model:'pocket-tts-1.0.3'}});
    await loadProject(staging);
    for (const file of ['skit.json','project.json']) await fs.rename(path.join(staging,file),path.join(directory,file));
  } finally { await fs.rm(staging,{recursive:true,force:true}); }
  report({ok:true,project:directory});
}
async function render() {
  const build=await buildProject(directory), bundle=await fs.readFile(build.bundle), staticRoot=path.join(ROOT,'src');
  const server=createServer(async(req,res)=>{
    try {
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(pathname==='/published/project.json'){res.setHeader('Content-Type','application/json');return res.end(bundle);}
      const file=await fs.realpath(path.join(staticRoot,pathname));
      if(!file.startsWith(staticRoot+path.sep))throw new Error('Path outside player');
      res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)] || 'application/octet-stream');
      res.end(await fs.readFile(file));
    } catch {res.statusCode=404;res.end('Not found');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(flags.get('port')||0),'127.0.0.1',resolve);});
  const output=path.resolve(flags.get('output') || path.join(directory,'output/render'));
  try {
    const config=await json(path.join(directory,'project.json'));
    const argv=[path.join(ROOT,'scripts/capture-skit.js'),'--skit','project','--base-url',`http://127.0.0.1:${server.address().port}`,'--output',output];
    if(config.tts.engine==='none')argv.push('--allow-silent');
    await run(process.execPath,argv,{cwd:ROOT});
    const manifest=await json(path.join(output,'project/manifest.json'));
    report({ok:true,...build,video:path.join(output,'project',manifest.media.video),cover:path.join(output,'project',manifest.media.cover),manifest:path.join(output,'project/manifest.json')});
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
try {
  if(flags.has('help')||!command||command==='help'||command==='--help')report({usage:'node scripts/theater.mjs <setup|doctor|init|import|validate|build|render> [project-directory]',setup:'setup [--tts] installs npm/Chromium, optionally isolated Pocket TTS (Linux/macOS; use WSL on Windows). Install FFmpeg with your OS package manager.',doctor:'doctor [--endpoint http://127.0.0.1:8001/tts] [--json]',init:'init path [--silent]',render:'render path [--port PORT] [--output PATH]',output:'JSON on stdout; errors return exit code 1. No LLM provider calls.'});
  else if(command==='doctor')await doctor();
  else if(command==='setup')await setup();
  else if(command==='init')await init();
  else if(command==='import')await importBundle();
  else if(command==='validate'){const p=await loadProject(directory);report({ok:true,warnings:p.warnings,assets:p.hashes});}
  else if(command==='build')report({ok:true,...await buildProject(directory)});
  else if(command==='render')await render();
  else throw new Error(`Unknown command ${command}`);
} catch(error){report({ok:false,error:error.message});process.exitCode=1;}
