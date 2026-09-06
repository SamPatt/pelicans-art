import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {prepareProject} from '../../src/js/editor-project.mjs';
import {pocketDefaults} from '../../scripts/theater/pocket.mjs';
import {TTS_URL} from '../config.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export async function speechConfig(){
 if(process.env.HERMES_EDITOR_TTS_CONFIG)return JSON.parse(await fs.readFile(process.env.HERMES_EDITOR_TTS_CONFIG,'utf8'));
 return {...pocketDefaults(),endpoint:TTS_URL.replace(/\/$/,'')+'/tts'};
}
export class EditorJobs {
 constructor({config=speechConfig,execute=executeCli,ttl=24*60*60*1000}={}){this.jobs=new Map();this.config=config;this.execute=execute;this.ttl=ttl;this.timer=setInterval(()=>{void this.prune().catch(()=>{});},60000);this.timer.unref();}
 async start(bundle,operation){
  if(!['voices','render'].includes(operation))throw Error('Choose voices or render.');
  if([...this.jobs.values()].filter(j=>j.status==='running').length>=2)throw Error('Two jobs are already running. Wait for one to finish.');
  if(this.jobs.size>=20)throw Error('The job queue is full. Remove finished jobs before starting another.');
  const project=prepareProject(bundle);if(operation==='voices')project.captionOnly=false;
  for(const group of ['sprites','backgrounds','props','audio'])for(const source of Object.values(project.assets[group]||{}))if(typeof source!=='string'||!source.startsWith('data:'))throw Error('Open a self-contained project with embedded assets.');
  if(JSON.stringify(project).length>64*1024*1024)throw Error('Project exceeds 64 MB.');
  const id=randomUUID(),job={id,operation,revision:bundle.editor?.revision,status:'running',created:Date.now(),controller:new AbortController()};
  this.jobs.set(id,job);
  job.done=this.work(job,project);return this.public(job);
 }
 async work(job,project){
  try{
   job.directory=await fs.mkdtemp(path.join(os.tmpdir(),'pelican-editor-'));
   const tts=await this.config();
   if(tts.profile?.voices&&!project.captionOnly){let line=0;for(const beat of project.script){if(beat.do!=='say')continue;const missing=!project.assets.audio[`line-${line++}`],voice=project.cast[beat.who]?.voice;if(missing&&!tts.profile.voices.includes(voice))throw Error(`Choose an available voice for ${beat.who} before updating recordings: ${tts.profile.voices.join(', ')}. Existing recordings are unchanged.`);}}
   // Configuration and executable are server-owned; the browser never supplies endpoints or paths.
   await fs.writeFile(path.join(job.directory,'project.json'),JSON.stringify({version:1,tts:project.captionOnly?{engine:'none'}:tts}));
   await fs.writeFile(path.join(job.directory,'skit.json'),JSON.stringify(project));
   await this.execute(job.operation==='render'?'render':'build',job.directory,job.controller.signal);
   job.status='ready';
  }catch(error){job.status='failed';job.message=job.controller.signal.aborted?'Job stopped. Your project is unchanged.':String(error.message).replaceAll(job.directory||'\0','[job]').slice(-1500);}
 }
 public(job){return {id:job.id,status:job.status,operation:job.operation,revision:job.revision,message:job.message};}
 get(id){const job=this.jobs.get(id);if(!job)throw Error('Job expired. Start it again.');return job;}
 async bundle(id){const j=this.get(id);if(j.status!=='ready')throw Error('Job is not ready.');return JSON.parse(await fs.readFile(path.join(j.directory,'output/project.json'),'utf8'));}
 video(id){const j=this.get(id);if(j.status!=='ready'||j.operation!=='render')throw Error('Video is not ready.');return path.join(j.directory,'output/render/project/project.mp4');}
 async remove(id){const j=this.get(id);j.controller.abort();await j.done;if(j.directory)await fs.rm(j.directory,{recursive:true,force:true});this.jobs.delete(id);}
 async prune(){for(const j of this.jobs.values())if(Date.now()-j.created>this.ttl)await this.remove(j.id);}
 async dispose(){clearInterval(this.timer);await Promise.all([...this.jobs.keys()].map(id=>this.remove(id)));}
}
function executeCli(operation,directory,signal){return new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,[path.join(root,'scripts/theater.mjs'),operation,directory],{cwd:root,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});let output='';
 for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output=(output+chunk.toString()).slice(-4000);});
 const stop=()=>{try{if(process.platform==='win32')child.kill();else process.kill(-child.pid,'SIGTERM');}catch{}};
 const timer=setTimeout(stop,15*60*1000);timer.unref();signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop();
 child.on('error',reject);child.on('close',code=>{clearTimeout(timer);signal.removeEventListener('abort',stop);if(code===0)resolve();else{let message='Voice or video job failed. Check that the configured speech server, FFmpeg and Chromium are ready.';try{message=JSON.parse(output).error||message;if(message==='fetch failed')message='The configured speech server could not be reached. Start it, verify its endpoint with doctor, and retry.';}catch{}reject(Error(message));}});
 });}
