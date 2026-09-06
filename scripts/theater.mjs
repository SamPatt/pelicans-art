#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { parseArgs } from 'node:util';
import { run as installRun } from './theater/project.mjs';
import { json, writeJson, run, loadProject, buildProject } from './theater/project.mjs';
import { pocketDefaults } from './theater/pocket.mjs';
import { deliverSvg } from './theater/svg.mjs';
import { preflight, checkVenv } from './theater/install-safety.mjs';
import { probeSpeech } from './theater/readiness.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(import.meta.url);
const args = process.argv.slice(2), command = args.shift();
let flags, directory;
function parseOptions() {
  const commands = {
    setup: {tts:'boolean',python:'string',check:'boolean',svg:'boolean'}, doctor: {json:'boolean',endpoint:'string',wait:'string'},
    svg: {source:'string',kind:'string',model:'string',title:'string'}, init: {silent:'boolean'}, import: {bundle:'string'}, validate: {}, build: {},
    render: {port:'string',output:'string'}, help: {}, '--help': {}
  };
  if (command && !Object.hasOwn(commands,command)) throw new Error(`Unknown command ${command}`);
  const options = Object.fromEntries(Object.entries({help:'boolean',...commands[command]}).map(([name,type])=>[name,{type}]));
  const parsed = parseArgs({args,options,allowPositionals:true,strict:true});
  flags = new Map(Object.entries(parsed.values));
  const acceptsDirectory = ['svg','init','import','validate','build','render'].includes(command);
  if (parsed.positionals.length > (acceptsDirectory ? 1 : 0)) throw new Error('Unexpected positional arguments; provide one project directory for project commands');
  if (command==='setup' && flags.has('svg') && (flags.has('tts') || flags.has('python'))) throw new Error('--svg cannot be combined with --tts or --python');
  if (command==='svg' && !flags.has('help') && parsed.positionals.length!==1) throw new Error('svg requires a new output directory');
  directory = path.resolve(parsed.positionals[0] || 'data/projects/my-skit');
  if (flags.has('wait') && (!flags.has('endpoint') || !/^\d+$/.test(flags.get('wait')) || Number(flags.get('wait'))>300)) throw new Error('--wait requires --endpoint and an integer number of seconds from 0 to 300');
  if (flags.has('port') && (!/^\d+$/.test(flags.get('port')) || Number(flags.get('port')) > 65535)) throw new Error('--port must be an integer from 0 to 65535');
}
const report = value => process.stdout.write(JSON.stringify(value,null,2)+'\n');
async function doctor() {
  const checks = {};
  for (const [name, argv] of Object.entries({node:['--version'],npm:['--version'],python3:['--version'],ffmpeg:['-version'],ffprobe:['-version']})) {
    try { checks[name]={ok:true,version:(await run(name,argv)).toString().split('\n')[0]}; } catch { checks[name]={ok:false,fix:`Install ${name}${name==='node'?' 22 or later':''}`}; }
  }
  checks.node.ok = Number(process.versions.node.split('.')[0]) >= 22;
  try { const {chromium}=require('@playwright/test'); const browser=await chromium.launch({headless:true}); await browser.close(); checks.chromium={ok:true}; }
  catch { checks.chromium={ok:false,fix:'Run npm run theater -- setup; Linux may also need npx playwright install-deps chromium'}; }
  const pocket = await pocketRuntime();
  if (flags.has('endpoint')) checks.speech=await probeSpeech(flags.get('endpoint'),{waitMs:Number(flags.get('wait') || 0)*1000});
  const ok=Object.values(checks).every(c=>c.ok); report({ok,checks,platform:process.platform,architecture:process.arch,pocketRuntime:pocket,speechChecked:flags.has('endpoint')}); if(!ok)process.exitCode=1;
}
async function pocketRuntime() {
  const directory=path.join(ROOT,'.runtime/pocket-tts-2.1.0');
  const executable=path.join(directory,'bin/pocket-tts'), python=path.join(directory,'bin/python');
  const exists=await fs.access(executable,fs.constants.X_OK).then(()=>true).catch(()=>false);
  if (!exists) return {installed:false,executable,python};
  try {
    const details=JSON.parse((await run(python,['-c','import sys,json,importlib.metadata;print(json.dumps({"pythonVersion":sys.version.split()[0],"version":importlib.metadata.version("pocket-tts")}))'])).toString());
    return {installed:true,ok:true,executable,python,...details};
  } catch { return {installed:true,ok:false,executable,python,message:'Could not inspect the isolated Pocket runtime'}; }
}
async function setup() {
  // Ignore installer environment overrides that could redirect Python writes.
  const installerEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>!(/^(PIP_|UV_|PYTHON|VIRTUAL_ENV$)/.test(key))));
  const run = (command,args,options={}) => installRun(command,args,{...options,env:installerEnv,timeout:20*60*1000,onOutput:flags.has('check')?undefined:chunk=>process.stderr.write(chunk)});
  const basePython = flags.get('python') || 'python3.12';
  const inspection = await preflight(ROOT,{tts:flags.has('tts'),svgOnly:flags.has('svg'),python:basePython,run});
  const footprint = ['node_modules',...(flags.has('svg')?[]:['server/node_modules']),...(flags.has('tts')?['.runtime/pocket-tts-2.1.0','.runtime/pocket-april-presets']:[])];
  const created = [];
  for (const entry of footprint) if (!await fs.lstat(path.join(ROOT,entry)).catch(()=>null)) created.push(entry);
  const receipt = {version:1,startedAt:new Date().toISOString(),inspection,plannedNewDirectories:created,createdDirectories:[],reusedDirectories:footprint.filter(p=>!created.includes(p)),processesStarted:[],sharedCaches:['npm','Playwright Chromium',...(flags.has('tts')?['pip/uv','Hugging Face']:[])],removal:'Review createdDirectories before removing anything. Preserve projects and shared caches. No system packages or services were installed.'};
  if (flags.has('check')) return report({ok:true,checkOnly:true,...receipt});
  console.error('Setup replaces this checkout’s node_modules. Downloads also use shared user caches. Pocket alone occupies about 1 GB, plus model and download caches.');
  await fs.mkdir(path.join(ROOT,'.runtime'),{recursive:true});
  const lockPath=path.join(ROOT,'.runtime/setup.lock');
  const lock=await fs.open(lockPath,'wx');
  try {
    const receiptPath=path.join(ROOT,'.runtime/install-receipt.json');
    // Keep a separate receipt for every attempt, including partial failures.
    const attemptPath=path.join(ROOT,'.runtime',`install-${Date.now()}.json`);
    await fs.writeFile(attemptPath,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
    console.error('Installing locked theater dependencies…');
    await run('npm',['ci'],{cwd:ROOT});
    if (!flags.has('svg')) await run('npm',['--prefix','server','ci'],{cwd:ROOT});
    console.error('Installing Chromium…');
    await run('npx',['playwright','install','chromium'],{cwd:ROOT});
    let tts;
    if (flags.has('tts')) {
      const env=path.join(ROOT,'.runtime/pocket-tts-2.1.0'), python=path.join(env,'bin/python');
      console.error('Installing isolated, hash-locked CPU speech runtime…');
      const hasUv = await run('uv',['--version']).then(()=>true).catch(()=>false);
      if (!await checkVenv(env,run)) {
        if (hasUv) await run('uv',['venv',env,'--python',basePython]);
        else await run(basePython,['-I','-m','venv',env]);
      }
      await checkVenv(env,run);
      const packages=['--require-hashes','--only-binary',':all:','-r',path.join(ROOT,inspection.speechLock.path),'--extra-index-url','https://download.pytorch.org/whl/cpu'];
      if (hasUv) await run('uv',['pip','install','--python',python,'--index-strategy','unsafe-best-match',...packages]);
      else await run(python,['-I','-m','pip','--isolated','install',...packages]);
      await run(python,[path.join(ROOT,'scripts/theater/pocket-server.py'),'prepare']);
      const runtime=await pocketRuntime();
      if (!runtime.ok) throw new Error('Installed Pocket runtime could not be verified');
      const serveCommand=[path.join(ROOT,'scripts/theater/pocket-server.py'),'serve','--port','8001'];
      tts={...runtime,...pocketDefaults(),executable:python,serveCommand,endpoint:'http://127.0.0.1:8001/tts',
        readiness:{executable:process.execPath,args:[path.join(ROOT,'scripts/theater.mjs'),'doctor','--endpoint','http://127.0.0.1:8001/tts','--wait','120','--json']}};
    }
    receipt.createdDirectories=[];
    for (const entry of created) if (await fs.lstat(path.join(ROOT,entry)).catch(()=>null)) receipt.createdDirectories.push(entry);
    receipt.completedAt=new Date().toISOString();
    await writeJson(attemptPath,receipt);
    await fs.writeFile(receiptPath+'.tmp',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
    await fs.rename(receiptPath+'.tmp',receiptPath);
    report({ok:true,tts,receipt:attemptPath,message:flags.has('svg')?'SVG preview dependencies installed. Run svg with your artwork; no speech service is needed.':'Dependencies installed. Run doctor with --endpoint to verify speech; TTS is not started automatically.'});
  } finally { await lock.close(); await fs.unlink(lockPath); }
}
async function init() {
  await fs.mkdir(directory,{recursive:true});
  const entries=await fs.readdir(directory); if(entries.length)throw new Error('Choose an empty project directory; existing work is never overwritten by init.');
  await fs.mkdir(path.join(directory,'assets'));
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150"><g id="body"><ellipse cx="48" cy="100" rx="27" ry="34" fill="#fff7df" stroke="#193b40" stroke-width="2"/><path d="M35 126v15h-14m38-15v15h15" fill="none" stroke="#efac35" stroke-width="5"/></g><g id="head-top"><path d="M32 76V38Q35 18 50 21Q72 24 68 46L64 77" fill="#fff7df" stroke="#193b40" stroke-width="2"/><ellipse id="eye-left-white" cx="44" cy="40" rx="6" ry="8" fill="white"/><ellipse id="eye-right-white" cx="59" cy="40" rx="6" ry="8" fill="white"/><circle id="eye-left-pupil" class="pupil" cx="46" cy="41" r="3" fill="#193b40"/><circle id="eye-right-pupil" class="pupil" cx="61" cy="41" r="3" fill="#193b40"/><path id="brow-left" d="M39 29h10" stroke="#193b40"/><path id="brow-right" d="M55 29h10" stroke="#193b40"/></g><g id="head-bottom"><path d="M47 51h48L53 68Z" fill="#efac35" stroke="#193b40"/><path id="mouth-closed" d="M49 55h37" stroke="#193b40"/><ellipse id="mouth-open" cx="61" cy="55" rx="10" ry="4" fill="#193b40" opacity="0"/></g></svg>`;
  await fs.writeFile(path.join(directory,'assets/pelican.svg'),svg);
  await fs.writeFile(path.join(directory,'assets/harbor.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><path fill="#f8e7bd" d="M0 0h1280v720H0z"/><path fill="#83b4b0" d="M0 300h1280v200H0z"/><path fill="#d8c39b" d="M0 500h1280v220H0z"/></svg>');
  await writeJson(path.join(directory,'project.json'),{version:1,tts:flags.has('silent')?{engine:'none'}:pocketDefaults()});
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
    bundle.audioBindings = Object.fromEntries(bundle.script.filter(b=>b?.do==='say').map((b,i)=>[`line-${i}`,{line:b.line,who:b.who,voice:bundle.cast[b.who]?.voice,tempo:bundle.cast[b.who]?.voiceTempo??1,pitch:bundle.cast[b.who]?.voicePitch??0}]));
    await writeJson(path.join(staging,'skit.json'),bundle);
    await writeJson(path.join(staging,'project.json'),{version:1,tts:bundle.captionOnly === true ? {engine:'none'} : pocketDefaults()});
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
  parseOptions();
  if(flags.has('help')||!command||command==='help'||command==='--help')report({usage:'node scripts/theater.mjs <setup|doctor|svg|init|import|validate|build|render> [project-directory]',setup:'setup [--check] [--svg | --tts --python python3.12]: preflight then local npm/Chromium; locked Pocket requires Linux x64 or ARM64 glibc 2.28+ and Python 3.12. --svg installs only root npm/Chromium for standalone artwork, without FFmpeg/Python/TTS. --check makes no installation changes. Missing OS packages require explicit user opt-in.',doctor:'doctor [--endpoint http://127.0.0.1:8001/tts] [--wait SECONDS] [--json]',svg:'svg new-output-directory --source drawing.svg [--kind artwork|character|background|prop] [--model MODEL] [--title TITLE]: validate and deliver SVG + PNG preview; the agent authors the SVG directly.',init:'init path [--silent]',import:'import path --bundle /path/to/project.json',validate:'validate path',build:'build path',render:'render path [--port PORT] [--output PATH]',output:'JSON on stdout; errors return exit code 1. No LLM provider calls.'});
  else if(command==='doctor')await doctor();
  else if(command==='setup')await setup();
  else if(command==='svg')report(await deliverSvg(directory,Object.fromEntries(flags)));
  else if(command==='init')await init();
  else if(command==='import')await importBundle();
  else if(command==='validate'){const p=await loadProject(directory);report({ok:true,warnings:p.warnings,assets:p.hashes});}
  else if(command==='build')report({ok:true,...await buildProject(directory)});
  else if(command==='render')await render();
  else throw new Error(`Unknown command ${command}`);
} catch(error){report({ok:false,error:error.message});process.exitCode=1;}
