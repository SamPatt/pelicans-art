import {it,expect} from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createServer} from 'node:http';
import {pocketDefaults,availableVoicePresets} from '../../scripts/theater/pocket.mjs';
import {EditorJobs} from './editor-jobs.js';
import {prepareProject,applyChanges} from '../../src/js/editor-project.mjs';
import {run,buildProject,json,writeJson} from '../../scripts/theater/project.mjs';
it('updates only missing speech, returns an editable bundle, and renders that bundle without new synthesis',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'editor-job-test-'));
 const wav=await run('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=2','-f','wav','pipe:1']);let requests=0;const bodies=[];
 const server=createServer(async(req,res)=>{requests++;let body='';for await(const chunk of req)body+=chunk;bodies.push(body);res.setHeader('X-Pelican-Pocket-Profile',req.headers['x-pelican-pocket-profile']||'');res.end(wav);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const config={...pocketDefaults(),endpoint:`http://127.0.0.1:${server.address().port}/tts`,textPrefix:''};const jobs=new EditorJobs({config:async()=>config});
 try{
  await run(process.execPath,[path.resolve('../scripts/theater.mjs'),'init',root]);
  const skit=await json(path.join(root,'skit.json'));skit.cast.clerk.voice='javert';await writeJson(path.join(root,'skit.json'),skit);expect(availableVoicePresets(config)).toContain('javert');
  await writeJson(path.join(root,'project.json'),{version:1,tts:config});const initial=prepareProject(await json((await buildProject(root)).bundle));expect(requests).toBe(3);
  const edited=applyChanges(initial,[{op:'voice',character:'clerk',tempo:2,pitch:12}]);expect(Object.keys(edited.assets.audio)).toHaveLength(2);
  const created=await jobs.start(edited,'voices');await jobs.get(created.id).done;expect(jobs.get(created.id).message).toBeUndefined();expect(jobs.get(created.id).status).toBe('ready');expect(requests).toBe(4);expect(bodies[3]).toContain('javert');
  const updated=await jobs.bundle(created.id);expect(updated.cast.clerk.voice).toBe('javert');expect(updated.assets.audio['line-0']).toBe(initial.assets.audio['line-0']);expect(updated.assets.audio['line-2']).toBe(initial.assets.audio['line-2']);expect(prepareProject(updated).assets.audio).toEqual(updated.assets.audio);
  const samples=await run('ffmpeg',['-v','error','-i','pipe:0','-f','f32le','-ar','16000','-ac','1','pipe:1'],{input:Buffer.from(updated.assets.audio['line-1'].split(',')[1],'base64')});
  const duration=samples.length/4/16000;expect(duration).toBeGreaterThan(.95);expect(duration).toBeLessThan(1.15);
  let crossings=0;for(let i=1600*4;i<12000*4;i+=4)if(samples.readFloatLE(i-4)<0&&samples.readFloatLE(i)>=0)crossings++;expect(crossings/(10400/16000)).toBeGreaterThan(860);expect(crossings/(10400/16000)).toBeLessThan(900);
  const rendered=await jobs.start(updated,'render');await jobs.get(rendered.id).done;expect(jobs.get(rendered.id).message).toBeUndefined();expect(requests).toBe(4);expect((await fs.stat(jobs.video(rendered.id))).size).toBeGreaterThan(1000);
  const manifest=await json(path.join(jobs.get(rendered.id).directory,'output/render/project/manifest.json'));expect(manifest.audioLinesMuxed).toBe(3);
 }finally{await jobs.dispose();server.closeAllConnections();server.close();await fs.rm(root,{recursive:true,force:true});}
},60000);
it('rejects external/local assets and cleans cancelled jobs without replacing the input',async()=>{
 const bundle=JSON.parse(await fs.readFile('../src/published/theDescription.json','utf8'));const bad=structuredClone(bundle);bad.assets.audio['line-0']='/etc/passwd';
 const jobs=new EditorJobs({config:async()=>({engine:'none'}),execute:async(_op,_dir,signal)=>new Promise((resolve,reject)=>{if(signal.aborted)return reject(Error('stop'));signal.addEventListener('abort',()=>reject(Error('stop')),{once:true});})});
 try{await expect(jobs.start(bad,'voices')).rejects.toThrow(/embedded/);const j=await jobs.start(bundle,'voices');await jobs.remove(j.id);expect(jobs.jobs.size).toBe(0);expect(bundle.editor).toBeUndefined();}finally{await jobs.dispose();}
});
