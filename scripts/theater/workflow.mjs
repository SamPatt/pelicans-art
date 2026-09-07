import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {buildProject,json,writeJson,hash,run,loadProject} from './project.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function safeFile(root,name){const base=await fs.realpath(root),file=await fs.realpath(path.resolve(base,name));if(!file.startsWith(base+path.sep)||!(await fs.stat(file)).isFile())throw Error(`File outside artifact directory: ${name}`);return file;}
async function fresh(root,prefix){await fs.mkdir(root,{recursive:true});if((await fs.lstat(root)).isSymbolicLink())throw Error('Output directory must not be a symlink');return fs.mkdtemp(path.join(root,prefix));}
async function fileInfo(file){const data=await fs.readFile(file);return {path:file,size:data.length,sha256:hash(data),mimeType:({'.mp4':'video/mp4','.zip':'application/zip','.json':'application/json','.png':'image/png','.html':'text/html'})[path.extname(file)]||'application/octet-stream'};}
async function serverFor(files,port=0){
 const staticRoot=await fs.realpath(path.join(ROOT,'src'));
 const server=createServer(async(req,res)=>{try{if(!['GET','HEAD'].includes(req.method)){res.statusCode=405;return res.end();}const url=new URL(req.url,'http://localhost');let file=files[url.pathname];if(!file)file=await safeFile(staticRoot,decodeURIComponent(url.pathname).replace(/^\//,''));res.setHeader('Content-Type',({'.html':'text/html','.json':'application/json','.png':'image/png','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');res.end(req.method==='HEAD'?undefined:await fs.readFile(file));}catch{res.statusCode=404;res.end('Not found');}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(port),'127.0.0.1',resolve);});return {server,origin:`http://127.0.0.1:${server.address().port}`,close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));}};
}
export async function previewProject(directory,{serve=false,port=0,baseUrl}={}){
 const started=performance.now(),build=await buildProject(directory),bundle=await json(build.bundle);const buildSeconds=(performance.now()-started)/1000;
 if(baseUrl){const u=new URL(baseUrl);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('--base-url must be an existing HTTP(S) theater server origin, without credentials or path');}
 // The standard private theater server already serves this directory. No upload occurs.
 const id=`preview-${randomUUID()}`,out=path.join(ROOT,'data/published',id);await fs.mkdir(out,{recursive:true});
 const bundleFile=path.join(out,'project.json'),pageFile=path.join(out,'index.html'),cover=path.join(out,'cover.png');await fs.copyFile(build.bundle,bundleFile);
 const route=`/published/${id}/`,src=`/skit-player.html?embed=1&captions=1&controls=below&url=${encodeURIComponent(route+'project.json')}`;const portrait=bundle.stage.orientation==='portrait';
 await fs.writeFile(pageFile,`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(bundle.meta.title)}</title><link rel="stylesheet" href="/site.css"><style>body{margin:0;background:var(--paper);color:var(--ink);font:18px/1.5 var(--font)}main{max-width:1000px;margin:auto;padding:24px}.frame{position:relative;aspect-ratio:${portrait?'9/16':'16/9'};${portrait?'max-width:430px;':''}margin:24px auto 80px}iframe{position:absolute;border:0;width:100%;height:calc(100% + 56px)}a{color:inherit}</style></head><body><main><h1>${escape(bundle.meta.title)}</h1><div class="frame"><iframe title="Skit preview" src="${escape(src)}" allow="autoplay"></iframe></div><a href="project.json" download>Editable project</a></main></body></html>`);
 const local=await serverFor({[route]:pageFile,[route+'project.json']:bundleFile,[route+'cover.png']:cover},port);
 let browser;
 try{const {chromium}=await import('@playwright/test');browser=await chromium.launch({headless:true});const p=await browser.newPage({viewport:portrait?{width:720,height:1336}:{width:1280,height:776}});await p.goto(local.origin+src);await p.waitForFunction(()=>document.body.dataset.playbackState==='ready',null,{timeout:30000});await p.locator('#viewport').screenshot({path:cover});await browser.close();browser=null;
 const offered=serve?local.origin:baseUrl;const result={ok:true,title:bundle.meta.title,orientation:bundle.stage.orientation,generated:build.generated,reused:build.reused,bundle:bundleFile,preview:pageFile,cover,url:offered?offered.replace(/\/$/,'')+route:null,serving:serve,bind:serve?'127.0.0.1':null,files:await Promise.all([bundleFile,pageFile,cover].map(fileInfo)),timing:{buildSeconds,totalSeconds:(performance.now()-started)/1000},note:serve?'Keep this command running; Ctrl-C stops only its loopback preview server. A loopback URL is not a phone-accessible VPS link.':baseUrl?'URL uses the existing theater server you supplied. No networking or hosting was changed.':'Preview files created. Use --serve for a loopback server or --base-url with an existing authorized theater server.'};
 if(serve)return {...result,close:local.close};await local.close();return result;
 }catch(e){if(browser)await browser.close();await local.close();throw e;}
}
async function renderArtifacts(directory,renderDir){
 const root=await fs.realpath(directory),folder=renderDir?path.resolve(renderDir):path.join(root,'output/render/project');const manifestFile=await safeFile(folder,'manifest.json'),manifest=await json(manifestFile);const video=await safeFile(folder,manifest.media?.video||'project.mp4');
 const probe=JSON.parse(await run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',video]));
 const duration=Number(probe.format?.duration);if(!Number.isFinite(duration)||duration<=0)throw Error('Rendered video has no valid duration');
 const bundleFile=await safeFile(root,'output/project.json'),bundle=await json(bundleFile),build=await json(await safeFile(root,'output/build-manifest.json'));
 if(!build.sourceHashes||build.sourceHashes.skit!==hash(await fs.readFile(path.join(root,'skit.json')))||build.sourceHashes.config!==hash(await fs.readFile(path.join(root,'project.json'))))throw Error('Source changed since build; render the current project first');
 const current=await loadProject(root);if(JSON.stringify(current.hashes)!==JSON.stringify(build.assets))throw Error('Asset files changed since build; render the current project first');
 const expected=bundle.script.filter(b=>b.do==='say').length;
 if(expected!==manifest.expectedDialogueLines)throw Error('Render manifest does not match the built dialogue count');
 // Confirm media and source correspond; count alone cannot identify a stale render.
 if(manifest.bundleSha256&&manifest.bundleSha256!==hash(await fs.readFile(bundleFile)))throw Error('Render is stale: rebuild/render the current project first');
 if(!manifest.bundleSha256)throw Error('Render lacks bundle fingerprint; render once with the current CLI before inspecting or packaging');
 return {root,folder,manifest,video,probe,duration,bundleFile,bundle,build};
}
export async function inspectProject(directory,{renderDir}={}){
 const a=await renderArtifacts(directory,renderDir);const out=await fresh(path.join(a.root,'output'),'inspection-');
 const expected=a.manifest.expectedDialogueLines,frames=[];const offsets=[0,...(a.manifest.dialogueTiming||[]).map(x=>Number(x.offsetMs)/1000+.15),Math.max(0,a.duration-.2)];
 for(const [i,time]of [...new Set(offsets.map(t=>Math.min(a.duration-.05,Math.max(0,t)).toFixed(3)))].entries()){
  const file=path.join(out,`frame-${String(i).padStart(3,'0')}.png`);await run('ffmpeg',['-v','error','-y','-ss',time,'-i',a.video,'-frames:v','1','-vf','scale=480:480:force_original_aspect_ratio=decrease',file]);frames.push({...await fileInfo(file),atSeconds:Number(time)});
 }
 const sheet=path.join(out,'contact-sheet.png');await run('ffmpeg',['-v','error','-y','-framerate','1','-i',path.join(out,'frame-%03d.png'),'-vf',`pad=480:480:(ow-iw)/2:(oh-ih)/2:color=0x153e47,tile=3x${Math.ceil(frames.length/3)}`,'-frames:v','1',sheet]);
 await run('ffmpeg',['-v','error','-i',a.video,'-f','null','-']);
 const silent=a.bundle.captionOnly===true,videoStream=a.probe.streams.find(s=>s.codec_type==='video'),orientation=a.bundle.stage.orientation||'landscape';const expectedSize=orientation==='portrait'?[720,1280]:[1280,720];
 const findings=[];if(videoStream?.width!==expectedSize[0]||videoStream?.height!==expectedSize[1])findings.push('Video dimensions do not match project orientation');if(!silent&&expected>0&&!a.probe.streams.some(s=>s.codec_type==='audio'))findings.push('Video has no audio stream');if(!silent&&(a.manifest.capturedDialogueLines!==expected||a.manifest.audioLinesMuxed!==expected))findings.push('Speech line coverage is incomplete');if(a.manifest.diagnostics?.length)findings.push(...a.manifest.diagnostics);
 const report={ok:findings.length===0,title:a.bundle.meta.title,duration:a.duration,orientation,streams:a.probe.streams.map(({codec_name,codec_type,width,height})=>({codec:codec_name,type:codec_type,width,height})),dialogue:{expected,captured:a.manifest.capturedDialogueLines,muxed:a.manifest.audioLinesMuxed},findings,frames,contactSheet:await fileInfo(sheet),video:await fileInfo(a.video),note:'Decode/timing/coverage checks are automatic. Review the images and listen to assess acting, clarity, and comedy.'};
 const reportFile=path.join(out,'inspection.json');await writeJson(reportFile,{...report,frames:frames.map(f=>({...f,path:path.basename(f.path)})),contactSheet:{...report.contactSheet,path:path.basename(sheet)},video:{...report.video,path:path.relative(out,a.video)}});return {...report,report:reportFile};
}
// ZIP writer uses the store method: no external archiver/Python dependency, no executable paths in archives.
function crc32(buf){let crc=0xffffffff;for(const n of buf){crc^=n;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
async function zipFiles(files,target){const out=await fs.open(target,'wx');let offset=0;const central=[];try{for(const f of files){const name=Buffer.from(f.name),bytes=await fs.readFile(f.file);if(bytes.length>0xffffffff||offset+bytes.length>0xffffffff)throw Error('ZIP exceeds supported 4 GB limit');const crc=crc32(bytes),header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(bytes.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(name.length,26);await out.write(header);await out.write(name);await out.write(bytes);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(33,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(bytes.length,20);c.writeUInt32LE(bytes.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);central.push(c,name);offset+=header.length+name.length+bytes.length;}const start=offset;for(const b of central){await out.write(b);offset+=b.length;}const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(offset-start,12);end.writeUInt32LE(start,16);await out.write(end);}finally{await out.close();}}
export async function packageProject(directory,{renderDir}={}){
 const a=await renderArtifacts(directory,renderDir);if(!a.bundle.captionOnly&&(a.manifest.capturedDialogueLines!==a.manifest.expectedDialogueLines||a.manifest.audioLinesMuxed!==a.manifest.expectedDialogueLines))throw Error('Cannot package incomplete speech');if(a.manifest.diagnostics?.length)throw Error('Resolve capture diagnostics before packaging');if(!a.bundle.captionOnly&&a.manifest.expectedDialogueLines>0&&!a.probe.streams.some(s=>s.codec_type==='audio'))throw Error('Cannot package a voiced video without an audio stream');
 const out=await fresh(path.join(a.root,'output'),'delivery-'),files=[],seen=new Set();const add=async(file,name)=>{if(seen.has(name))return;seen.add(name);files.push({file,name:`project/${name}`});};
 for(const name of ['project.json','skit.json','output/project.json','output/build-manifest.json'])await add(await safeFile(a.root,name),name);
 const config=await json(path.join(a.root,'project.json'));if(config.tts?.endpoint){const u=new URL(config.tts.endpoint);if(u.username||u.password||u.search)throw Error('Do not package credentials/query parameters in speech endpoints; use tokenEnv');}if(Object.keys(config.tts||{}).some(k=>/^(token|authToken|apiKey|password|secret)$/i.test(k)))throw Error('Do not package inline credentials; use tokenEnv');
 const source=await json(path.join(a.root,'skit.json'));
 for(const group of ['sprites','backgrounds','props','audio'])for(const value of Object.values(source.assets?.[group]||{}))if(typeof value==='string'&&!value.startsWith('data:')){const f=await safeFile(a.root,value),relative=path.relative(a.root,path.resolve(a.root,value)).split(path.sep).join('/');if(relative.split('/').some(s=>s.startsWith('.')||['node_modules','output'].includes(s))||!['.svg','.mp3','.wav','.ogg'].includes(path.extname(f)))throw Error('Source asset is not a portable asset file');await add(f,relative);const sidecar=path.join(path.dirname(value),'meta.json');if(await fs.lstat(path.resolve(a.root,sidecar)).catch(()=>null)){const meta=await safeFile(a.root,sidecar);if((await fs.stat(meta)).size>1024*1024)throw Error('Asset metadata exceeds 1 MB');await json(meta);await add(meta,path.relative(a.root,path.resolve(a.root,sidecar)).split(path.sep).join('/'));}}
 for(const name of ['video','cover','still'])if(a.manifest.media[name])await add(await safeFile(a.folder,a.manifest.media[name]),`output/render/project/${path.basename(a.manifest.media[name])}`);
 await add(await safeFile(a.folder,'manifest.json'),'output/render/project/manifest.json');
 const notes=path.join(out,'DELIVERY-NOTES.md');await fs.writeFile(notes,`# ${a.bundle.meta.title}\n\nOpen output/project.json in the companion Editor, or use the source skit.json and project.json with the CLI.\n\nModel: ${a.bundle.meta.model||'Unknown'}\nRuntime: ${a.build.revision}\nSpeech: ${a.build.configuredSpeech?.profile?.package||'See source project.json'}\nVideo: ${a.duration} seconds; ${a.manifest.audioLinesMuxed}/${a.manifest.expectedDialogueLines} lines muxed.\n\nOn another machine, configure a compatible speech endpoint before revising dialogue. Existing recordings are embedded. Run inspect and review its images/audio before delivery. Sources/cache remain on the authoring machine; caches, credentials and dependencies are not included.\n`);await add(notes,'DELIVERY-NOTES.md');
 const zip=path.join(out,'editable-project.zip');await zipFiles(files,zip);await verifyStoredZip(zip,files.map(f=>f.name));const result={ok:true,title:a.bundle.meta.title,video:await fileInfo(a.video),bundle:await fileInfo(a.bundleFile),archive:await fileInfo(zip),archiveVerified:true,entries:files.map(f=>f.name),note:'Packaging does not upload or change network access. Attach these files in chat or use existing authorized delivery.'};await writeJson(path.join(out,'delivery.json'),{...result,video:{...result.video,path:path.relative(out,a.video)},bundle:{...result.bundle,path:path.relative(out,a.bundleFile)},archive:{...result.archive,path:path.basename(zip)}});return {...result,manifest:path.join(out,'delivery.json')};
}

// Verify our stored ZIP after writing: central directory, local records and payload CRCs.
export async function verifyStoredZip(file,expectedNames){
 const b=await fs.readFile(file),fail=()=>{throw Error('Delivery ZIP integrity check failed');};
 if(b.length<22)fail();const end=b.length-22;
 if(b.readUInt32LE(end)!==0x06054b50||b.readUInt16LE(end+20)!==0)fail();
 const count=b.readUInt16LE(end+10),start=b.readUInt32LE(end+16),size=b.readUInt32LE(end+12);
 if(start+size!==end||count!==expectedNames.length)fail();let pos=start;const names=[];
 for(let i=0;i<count;i++){
  if(pos+46>end||b.readUInt32LE(pos)!==0x02014b50)fail();
  const length=b.readUInt32LE(pos+24),crc=b.readUInt32LE(pos+16),n=b.readUInt16LE(pos+28),extra=b.readUInt16LE(pos+30),comment=b.readUInt16LE(pos+32),local=b.readUInt32LE(pos+42);
  if(pos+46+n+extra+comment>end||local+30>start||b.readUInt32LE(local)!==0x04034b50||b.readUInt16LE(pos+10)!==0)fail();
  const name=b.subarray(pos+46,pos+46+n).toString(),ln=b.readUInt16LE(local+26),le=b.readUInt16LE(local+28),data=local+30+ln+le;
  if(data+length>start||b.readUInt16LE(local+8)!==0||b.readUInt32LE(local+18)!==length||b.readUInt32LE(local+22)!==length||b.readUInt32LE(local+14)!==crc||b.subarray(local+30,local+30+ln).toString()!==name||crc32(b.subarray(data,data+length))!==crc)fail();
  names.push(name);pos+=46+n+extra+comment;
 }
 if(pos!==end||JSON.stringify(names)!==JSON.stringify(expectedNames))fail();return true;
}
