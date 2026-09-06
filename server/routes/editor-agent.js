import {availableVoicePresets} from '../../scripts/theater/pocket.mjs';
import express from 'express';
import {randomUUID} from 'node:crypto';
import {EditorJobs,speechConfig} from '../services/editor-jobs.js';
import {EditorAgent} from '../services/editor-agent.js';
export function createEditorAgentRouter({enabled=()=>process.env.HERMES_EDITOR_ENABLED==='1',createAgent=()=>new EditorAgent({command:process.env.HERMES_EDITOR_COMMAND||'hermes',sessionCwd:process.env.HERMES_EDITOR_CWD||process.cwd()})}={}){
 const router=express.Router(),sessions=new Map(),jobs=new EditorJobs();
 const prune=setInterval(()=>{for(const[id,s]of sessions)if(Date.now()-s.touched>30*60*1000){s.agent.close();sessions.delete(id);}},60000);prune.unref();
 router.get('/status',async(req,res)=>{const config=enabled()?await speechConfig().catch(()=>null):null;res.json({enabled:enabled(),agent:'Hermes',jobs:enabled(),voicePresets:availableVoicePresets(config)});});
 router.use((req,res,next)=>{
  const host=(req.headers.host||'').toLowerCase();
  let configured='';try{configured=new URL(process.env.HERMES_EDITOR_ORIGIN||'').host;}catch{}
  if(!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)&&host!==configured)return res.status(403).json({message:'Agent chat requires a trusted local host or the configured private Editor origin.'});
  if(req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({message:'Cross-site agent requests are not allowed.'});
  if(!enabled())return res.status(404).json({message:'Open the Editor on your private server with the Hermes connection enabled.'});next();});
 router.post('/jobs',async(req,res)=>{try{res.status(202).json(await jobs.start(req.body?.project,req.body?.operation));}catch(e){res.status(400).json({message:e.message});}});
 router.get('/jobs/:id', (req,res)=>{try{res.json(jobs.public(jobs.get(req.params.id)));}catch(e){res.status(404).json({message:e.message});}});
 router.get('/jobs/:id/project',async(req,res)=>{try{res.json(await jobs.bundle(req.params.id));}catch(e){res.status(409).json({message:e.message});}});
 router.get('/jobs/:id/video',(req,res)=>{try{res.download(jobs.video(req.params.id),'pelican-skit.mp4');}catch(e){res.status(409).json({message:e.message});}});
 router.delete('/jobs/:id',async(req,res)=>{try{await jobs.remove(req.params.id);res.json({ok:true});}catch(e){res.status(404).json({message:e.message});}});
 router.post('/sessions',async(req,res)=>{if(sessions.size>=4)return res.status(429).json({message:'Close an existing agent connection before opening another.'});const id=randomUUID(),agent=createAgent(),s={agent,events:[],sequence:0,touched:Date.now(),textSize:0};sessions.set(id,s);
  agent.on('event',event=>{s.textSize+=event.text?.length||0;if(s.textSize>500000&&event.type==='text'){s.textSize=0;agent.close();return;}s.events.push({...event,id:++s.sequence});if(s.events.length>2000)s.events.shift();});
  try{await agent.connect();res.json({id});}catch(e){agent.close();sessions.delete(id);res.status(503).json({message:e.message});}
 });
 router.use('/sessions/:id',(req,res,next)=>{const s=sessions.get(req.params.id);if(!s)return res.status(404).json({message:'Agent session expired. Reconnect to start a new conversation.'});s.touched=Date.now();req.editorSession=s;next();});
 router.get('/sessions/:id/events',(req,res)=>{const after=Number(req.query.after)||0;res.json({events:req.editorSession.events.filter(e=>e.id>after)});});
 router.post('/sessions/:id/messages',(req,res)=>{const {request,context}=req.body||{},s=req.editorSession;if(typeof request!=='string'||!request.trim()||request.length>6000||!context||JSON.stringify(context).length>1000000)return res.status(400).json({message:'Open a project and enter a request under 6,000 characters.'});if(s.agent.busy)return res.status(409).json({message:'Wait for the current reply or stop it first.'});s.textSize=0;s.agent.prompt(request,context).catch(error=>s.agent.emit('event',{type:'error',message:error.message}));res.status(202).json({ok:true});});
 router.post('/sessions/:id/permission',(req,res)=>{try{req.editorSession.agent.permission(req.body?.requestId,req.body?.optionId);res.json({ok:true});}catch(e){res.status(400).json({message:e.message});}});
 router.post('/sessions/:id/cancel',(req,res)=>{try{req.editorSession.agent.cancel();res.json({ok:true});}catch{res.status(409).json({message:'The agent session has already closed.'});}});
 router.delete('/sessions/:id',(req,res)=>{req.editorSession.agent.close();sessions.delete(req.params.id);res.json({ok:true});});
 router.dispose=()=>{void jobs.dispose();clearInterval(prune);for(const s of sessions.values())s.agent.close();sessions.clear();};return router;
}
export default createEditorAgentRouter();
