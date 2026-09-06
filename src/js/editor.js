import {prepareProject,applyChanges,voiceNeeds,contextFor,copyRequest} from './editor-project.mjs';
const $=id=>document.getElementById(id);
const el=(tag,attrs={},value)=>{const n=document.createElement(tag);for(const [k,v]of Object.entries(attrs))if(k==='class')n.className=v;else n.setAttribute(k,v);if(value!==undefined)n.textContent=value;return n;};
let project=null,selection={kind:'scene'},undo=[],redo=[],previewUrl,session=null,after=0,pollTimer,busy=false,proposal=null,proposalRevision,agentText='',agentNode=null;
const notice=message=>{$('notice').textContent=message;};
const decoder=new TextDecoder(),encoder=new TextEncoder();
function decode(data){return decoder.decode(Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0)));}
function encode(svg){let binary='';for(const byte of encoder.encode(svg))binary+=String.fromCharCode(byte);return 'data:image/svg+xml;base64,'+btoa(binary);}
function safeSvg(svg){return window.AITSvgSanitizer.sanitize(svg,{isolated:true});}
function sanitizeProject(input){
 const p=prepareProject(input);
 for(const type of ['sprites','backgrounds','props'])for(const [name,data]of Object.entries(p.assets[type]||{})){
  if(typeof data!=='string'||!/^data:image\/(svg\+xml|png|jpeg|webp);base64,/.test(data))throw Error(`“${name}” is not embedded. Ask your agent for the built output/project.json with its assets included.`);
  if(data.startsWith('data:image/svg+xml'))p.assets[type][name]=encode(safeSvg(decode(data)));
  else if(type==='sprites')throw Error('Characters must be SVG artwork.');
 }
 for(const data of Object.values(p.assets.audio)){if(typeof data!=='string'||!/^data:audio\/(mpeg|mp3|wav|x-wav|ogg);base64,/.test(data))throw Error('The project contains unsupported audio. Ask your agent to embed WAV, MP3, or OGG recordings.');}
 return p;
}
function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open('pelican-companion-editor',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function save(){if(!project)return;try{const database=await db();await new Promise((resolve,reject)=>{const tx=database.transaction('projects','readwrite');tx.objectStore('projects').put(project,'current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});database.close();$('save-status').textContent='Saved on this device';}catch{$('save-status').textContent='Device save unavailable—export a backup';}}
function stopPreview(){if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;$('preview').removeAttribute('src');$('playback').hidden=true;$('layout-stage').hidden=false;$('play').hidden=false;$('edit-layout').hidden=true;}
function update(changes){try{const next=applyChanges(project,changes);undo.push(project);if(undo.length>20)undo.shift();redo=[];project=next;stopPreview();render();save();notice('Changes saved. Undo is available.');return true;}catch(e){notice(e.message);return false;}}
function select(value){selection=value;if(value.kind==='beat'&&matchMedia('(max-width:650px)').matches)document.querySelector('.inspector').scrollIntoView({block:'start'});renderSelection();renderBeats();renderCast();for(const actor of $('layout-stage').querySelectorAll('.actor'))actor.classList.toggle('selected',selection.kind==='character'&&actor.dataset.character===selection.id);}
function load(input){const next=sanitizeProject(input);stopPreview();project=next;undo=[];redo=[];selection={kind:'scene'};proposal=null;$('apply-proposal').hidden=true;render();save();notice('Project opened. Your original file is unchanged.');}
function render(){
 $('welcome').hidden=!!project;$('workspace').hidden=!project;$('export-project').disabled=!project;$('undo').disabled=!undo.length;$('redo').disabled=!redo.length;if(!project)return;
 if(selection.kind==='beat'&&!project.script[selection.index])selection={kind:'scene'};
 $('project-title').value=project.meta.title;const missing=voiceNeeds(project).length;$('voice-status').textContent=missing?`${missing} line${missing===1?'':'s'} need${missing===1?'s':''} an updated recording. Preview uses captions for these lines.`:'Recorded dialogue is preserved.';
 renderStage();renderCast();renderSelection();renderBeats();
}
function renderStage(){
 const stage=$('layout-stage');stage.replaceChildren();const portrait=project.stage.orientation==='portrait';stage.style.aspectRatio=portrait?'9/16':'16/9';$('playback').style.aspectRatio=portrait?'9/16':'16/9';stage.style.maxWidth=portrait?'440px':'';$('playback').style.maxWidth=portrait?'440px':'';
 const bg=project.assets.backgrounds[project.stage.background];if(bg)stage.append(el('img',{src:bg,alt:''}));
 for(const [name,c]of Object.entries(project.cast)){
  const opening=project.script.find(b=>b.do==='background');
  const visible=opening?.show?opening.show.includes(name):!c.startOffscreen;
  const selected=selection.kind==='character'&&selection.id===name;
  const chosen=selection.kind==='character'?project.cast[selection.id]:null;
  const overlapsSelected=chosen&&name!==selection.id&&Math.abs((chosen.x??50)-(c.x??50))<4;
  if((!visible&&!selected)||overlapsSelected)continue;
  const source=project.assets.sprites[`${c.sprite}-front`];if(!source)continue;
  const actor=el('button',{type:'button',class:'actor','aria-label':`Move ${name}`,'data-character':name});const artworkHost=el('span');artworkHost.style.display='block';artworkHost.style.height='100%';actor.append(artworkHost);const artwork=artworkHost.attachShadow({mode:'closed'});artwork.innerHTML=safeSvg(decode(source));const svg=artwork.querySelector('svg');svg.style.height='100%';svg.style.width='auto';svg.style.display='block';svg.style.pointerEvents='none';actor.style.left=`${c.startX??c.x??50}%`;actor.style.bottom=`${100-(c.startY??c.y??88)}%`;actor.style.height=`${40*(c.scale||1)}%`;actor.classList.toggle('selected',selection.kind==='character'&&selection.id===name);
  actor.addEventListener('click',()=>select({kind:'character',id:name}));
  let drag;
  actor.addEventListener('pointerdown',event=>{if(event.button!==0)return;select({kind:'character',id:name});drag={x:event.clientX,y:event.clientY,startX:c.startX??c.x??50,startY:c.startY??c.y??88,rect:stage.getBoundingClientRect()};actor.setPointerCapture(event.pointerId);});
  actor.addEventListener('pointermove',event=>{if(!drag)return;drag.nextX=Math.max(0,Math.min(100,drag.startX+(event.clientX-drag.x)/drag.rect.width*100));drag.nextY=Math.max(0,Math.min(100,drag.startY+(event.clientY-drag.y)/drag.rect.height*100));actor.style.left=`${drag.nextX}%`;actor.style.bottom=`${100-drag.nextY}%`;});
  actor.addEventListener('pointerup',()=>{const end=drag;drag=null;if(end?.nextX!==undefined)update([{op:'position',character:name,x:+end.nextX.toFixed(1),y:+end.nextY.toFixed(1)}]);});
  actor.addEventListener('pointercancel',()=>{drag=null;renderStage();});stage.append(actor);
 }
}
function renderCast(){const box=$('cast-list');box.replaceChildren();const scene=el('button',{'aria-pressed':selection.kind==='scene'},'Scene');scene.onclick=()=>{select({kind:'scene'});renderStage();};box.append(scene);for(const name of Object.keys(project.cast)){const button=el('button',{'aria-pressed':selection.kind==='character'&&selection.id===name},name);button.onclick=()=>{select({kind:'character',id:name});renderStage();};box.append(button);}}
function inputField(parent,label,value,type='text',attrs={}){const wrap=el('label',{},label),input=el(type==='textarea'?'textarea':'input',{...(type==='textarea'?{rows:3}:{type}),...attrs});input.value=value;wrap.append(input);parent.append(wrap);return input;}
function action(parent,label,fn){const b=el('button',{type:'button'},label);b.onclick=fn;parent.append(b);return b;}
function renderSelection(){
 const box=$('selection-controls');box.replaceChildren();
 if(selection.kind==='character'){
  const c=project.cast[selection.id];$('selection-title').textContent=selection.id;box.append(el('p',{class:'quiet'},'Opening position. Later stage directions still play as written.'));
  const coords=el('div',{class:'coordinates'});box.append(coords);const x=inputField(coords,'Across (%)',c.startX??c.x??50,'number',{min:0,max:100,step:1}),y=inputField(coords,'Down (%)',c.startY??c.y??88,'number',{min:0,max:100,step:1}),scale=inputField(box,'Size',c.scale||1,'number',{min:.1,max:3,step:.05});action(box,'Update position',()=>update([{op:'position',character:selection.id,x:+x.value,y:+y.value,scale:+scale.value}]));
 }else if(selection.kind==='beat'){
  const b=project.script[selection.index];$('selection-title').textContent=b.do==='say'?`${b.who}’s line`:b.do==='pause'?'A pause':`Stage direction: ${b.do}`;
  if(b.do==='say'){const line=inputField(box,'Dialogue',b.line,'textarea',{maxlength:4000});action(box,'Save line',()=>update([{op:'dialogue',index:selection.index,text:line.value}]));}
  else if(b.do==='pause'){const pause=inputField(box,'Pause (seconds)',b.duration??1,'number',{min:0,max:60,step:.1});action(box,'Save pause',()=>update([{op:'pause',index:selection.index,seconds:+pause.value}]));}
  else box.append(el('p',{class:'quiet'},JSON.stringify(b)));
  action(box,'Add a pause after this',()=>{const index=selection.index;if(update([{op:'insertPause',after:index,seconds:.5}]))select({kind:'beat',index:index+1});});
  const move=el('div',{class:'coordinates'});box.append(move);action(move,'Move earlier',()=>{const i=selection.index;if(i>0&&update([{op:'moveBeat',from:i,to:i-1}]))select({kind:'beat',index:i-1});}).disabled=selection.index===0;action(move,'Move later',()=>{const i=selection.index;if(i<project.script.length-1&&update([{op:'moveBeat',from:i,to:i+1}]))select({kind:'beat',index:i+1});}).disabled=selection.index===project.script.length-1;
  action(box,'Remove this action',()=>update([{op:'removeBeat',index:selection.index}]));
 }else{
  $('selection-title').textContent='Scene';const label=el('label',{},'Opening backdrop'),select=el('select',{'aria-label':'Opening backdrop'});for(const name of Object.keys(project.assets.backgrounds))select.append(el('option',{value:name},name));select.value=project.stage.background;label.append(select);box.append(label);select.onchange=()=>update([{op:'background',name:select.value}]);box.append(el('p',{class:'quiet'},'Choose a character on the stage or a line below. Ask your agent for new artwork, bigger changes, or a finished video.'));
 }
}
function renderBeats(){const box=$('beats');box.replaceChildren();let speech=0;project.script.forEach((b,index)=>{const lineIndex=b.do==='say'?speech++:null;if(!$('show-directions').checked&&!['say','pause'].includes(b.do))return;const button=el('button',{class:'beat'+(selection.kind==='beat'&&selection.index===index?' selected':''),'data-index':index});button.append(el('strong',{},b.do==='say'?b.who:b.do==='pause'?'Pause':b.do),el('span',{},b.do==='say'?b.line:b.do==='pause'?`${b.duration??1} seconds`:JSON.stringify(b)));if(b.do==='say'&&!project.captionOnly&&!project.assets.audio[`line-${lineIndex}`])button.append(el('small',{},'Voice needs update'));button.onclick=()=>select({kind:'beat',index});box.append(button);});}
$('import-project').onclick=()=>$('project-file').click();$('project-file').onchange=async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>64*1024*1024)throw Error('Choose a project smaller than 64 MB.');load(JSON.parse(await file.text()));}catch(e){notice(e.message);}finally{event.target.value='';}};
$('sample').onclick=async()=>{try{$('sample').disabled=true;const r=await fetch('published/theDescription.json');if(!r.ok)throw Error('The sample could not load. Please try again.');load(await r.json());}catch(e){notice(e.message);}finally{$('sample').disabled=false;}};
$('export-project').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(project,null,2)],{type:'application/json'})),a=el('a',{href:url,download:(project.meta.title.replace(/[^a-z0-9-]/gi,'-').slice(0,70)||'skit')+'.project.json'});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('Project exported. Send it to your agent for revisions or a rendered video.');};
$('project-title').onchange=()=>update([{op:'title',text:$('project-title').value}]);$('show-directions').onchange=renderBeats;
$('undo').onclick=()=>{if(!undo.length)return;redo.push(project);project=undo.pop();stopPreview();render();save();};$('redo').onclick=()=>{if(!redo.length)return;undo.push(project);project=redo.pop();stopPreview();render();save();};
$('play').onclick=()=>{stopPreview();previewUrl=URL.createObjectURL(new Blob([JSON.stringify(project)],{type:'application/json'}));$('preview').src=`skit-player.html?embed=1&captions=1&controls=below&recordedOnly=1&url=${encodeURIComponent(previewUrl)}`;$('layout-stage').hidden=true;$('playback').hidden=false;$('play').hidden=true;$('edit-layout').hidden=false;};$('edit-layout').onclick=stopPreview;
$('copy-request').onclick=async()=>{const value=copyRequest(project,selection,$('agent-request').value);try{await navigator.clipboard.writeText(value);notice('Request copied. Paste it into your agent chat with your latest project export.');}catch{$('agent-request').value=value;$('agent-request').select();notice('Copy the selected request text.');}};
async function api(path,method='GET',body){const r=await fetch('/api/editor-agent'+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const result=await r.json().catch(()=>({message:'The agent connection is available on your private local server.'}));if(!r.ok)throw Error(result.message||'Agent connection failed.');return result;}
function chatMessage(value,role='agent'){const node=el('div',{class:'chat-message '+role},value);$('chat-log').append(node);node.scrollIntoView({block:'nearest'});return node;}
function chatBusy(value){busy=value;$('send-chat').disabled=value;$('cancel-chat').hidden=!value;}
async function disconnect(){clearTimeout(pollTimer);if(session)await api(`/sessions/${session}`,'DELETE').catch(()=>{});session=null;chatBusy(false);$('chat-form').hidden=true;$('connection-status').textContent='Disconnected. Your project is still saved here.';}
$('connect').onclick=async()=>{
 $('chat-panel').hidden=false;if(session)return;$('connection-status').textContent='Checking your private agent connection…';$('connection-help').hidden=true;
 try{const status=await api('/status');if(!status.enabled){$('connection-help').hidden=false;$('connection-status').textContent='Connect from the Editor running alongside Hermes.';return;}const connection=await api('/sessions','POST',{});session=connection.id;after=0;$('connection-status').textContent='Connected to Hermes. This is a new project conversation using your existing Hermes setup.';$('chat-form').hidden=false;poll();}catch(e){$('connection-status').textContent=e.message;$('connection-help').hidden=false;}
};
$('close-chat').onclick=()=>{$('chat-panel').hidden=true;};$('disconnect').onclick=disconnect;$('cancel-chat').onclick=()=>api(`/sessions/${session}/cancel`,'POST',{}).catch(e=>chatMessage(e.message));
$('chat-form').onsubmit=async event=>{event.preventDefault();if(busy)return;if(!project){chatMessage('Open a project first so Hermes has a scene to work with.');return;}const request=$('chat-input').value.trim();if(!request)return;proposal=null;proposalRevision=project.editor.revision;$('apply-proposal').hidden=true;chatMessage(request,'user');agentText='';agentNode=chatMessage('');chatBusy(true);$('chat-input').value='';const context=contextFor(project,selection);if(selection.kind==='character'){const key=project.cast[selection.id].sprite+'-front';context.selectedSvg={name:key,svg:decode(project.assets.sprites[key])};}try{await api(`/sessions/${session}/messages`,'POST',{request,context});}catch(e){chatMessage(e.message);chatBusy(false);}};
async function poll(){if(!session)return;try{const result=await api(`/sessions/${session}/events?after=${after}`);for(const event of result.events){after=event.id;if(event.type==='text'){agentText+=event.text;if(!agentNode)agentNode=chatMessage('');agentNode.textContent=agentText;}else if(event.type==='permission')showPermission(event);else if(event.type==='error'){chatMessage(event.message);chatBusy(false);$('permission').hidden=true;if(event.fatal){session=null;$('chat-form').hidden=true;$('connection-status').textContent='Connection ended. Reconnect to start a new conversation.';}}else if(event.type==='done'){chatBusy(false);$('permission').hidden=true;try{const block=agentText.match(/```(?:json)?\s*([\s\S]*?)```/);const parsed=JSON.parse(block?block[1]:agentText);if(Array.isArray(parsed.changes)&&parsed.changes.length){proposal=parsed.changes;$('apply-proposal').hidden=false;}}catch{}if(!proposal)chatMessage('You can continue the conversation or copy a request to your usual agent chat.');}}}catch(e){chatMessage(e.message);session=null;chatBusy(false);$('chat-form').hidden=true;$('connection-status').textContent='Connection ended. Reconnect to start a new conversation.';}if(session)pollTimer=setTimeout(poll,800);}
function showPermission(event){const box=$('permission');box.replaceChildren(el('p',{},event.title||'Hermes requests permission.'));for(const option of event.options.filter(o=>o.kind==='allow_once'||o.kind==='reject_once'))action(box,option.name,async()=>{try{await api(`/sessions/${session}/permission`,'POST',{requestId:event.requestId,optionId:option.optionId});box.hidden=true;}catch(e){chatMessage(e.message);}});box.hidden=false;}
$('apply-proposal').onclick=()=>{
 if(!proposal)return;if(project.editor.revision!==proposalRevision){chatMessage('Your project changed after this request. Ask Hermes again using the latest project; these edits were not applied.');$('apply-proposal').hidden=true;return;}
 try{const changes=proposal.map(c=>c.op==='sprite'?{...c,data:encode(safeSvg(c.svg))}:c);if(update(changes)){$('apply-proposal').hidden=true;chatMessage('Edits applied. Preview them on the stage; Undo will restore your previous version.');}}catch(e){chatMessage(e.message);}
};
(async()=>{try{const database=await db();const saved=await new Promise((resolve,reject)=>{const r=database.transaction('projects').objectStore('projects').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});database.close();if(saved)load(saved);}catch{notice('Device storage is unavailable. You can still open and export projects.');}})();
