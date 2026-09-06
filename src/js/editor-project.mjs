const own=(object,key)=>Object.hasOwn(object||{},key);
const id=()=>crypto.randomUUID();
const clone=value=>structuredClone(value);
const number=(value,min,max,label)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(`${label} must be between ${min} and ${max}.`);return value;};
const text=(value,max=4000)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(`Enter text between 1 and ${max} characters.`);return value;};
export function prepareProject(input){
 const p=clone(input);
 if(!p||typeof p!=='object'||!p.stage||!p.cast||Array.isArray(p.cast)||!Array.isArray(p.script)||!p.assets?.sprites||!p.assets?.backgrounds)throw Error('Choose the agent’s built output/project.json or an Editor export. A setup configuration is not an editable skit.');
 if(p.script.length>2000||Object.keys(p.cast).length>100)throw Error('This project is too large for the Editor.');
 if(p.script.some(b=>!b||typeof b!=='object'||typeof b.do!=='string'))throw Error('The project contains an invalid scene action.');
 for(const [name,c] of Object.entries(p.cast)){if(['__proto__','constructor','prototype'].includes(name)||!c||typeof c.sprite!=='string')throw Error('Invalid character in project.');}
 p.meta={...p.meta,title:p.meta?.title||'Untitled skit'};
 p.assets.audio=p.assets.audio||{};
 const oldIds=p.editor?.beatIds;
 const validIds=Array.isArray(oldIds)&&oldIds.length===p.script.length&&oldIds.every(v=>typeof v==='string')&&new Set(oldIds).size===oldIds.length;
 p.editor={version:1,revision:id(),beatIds:validIds?oldIds:p.script.map(id)};
 // Imported recordings with explicit stale bindings must never be played as current dialogue.
 let line=0;
 for(const b of p.script){if(b.do!=='say')continue;const key=`line-${line++}`,binding=p.audioBindings?.[key];if(binding&&(binding.line!==b.line||binding.who!==b.who||binding.voice!==p.cast[b.who]?.voice))delete p.assets.audio[key];}
 return p;
}
export function voiceNeeds(p){let line=0;return p.script.filter(b=>b.do==='say').map(b=>({beat:b,key:`line-${line++}`})).filter(({key})=>!p.captionOnly&&!p.assets.audio[key]);}
export function applyChanges(project,changes){
 if(!Array.isArray(changes)||!changes.length||changes.length>100)throw Error('An edit must contain 1–100 changes.');
 const p=clone(project), recordings=new Map();let line=0;
 project.script.forEach((b,i)=>{if(b.do==='say'){recordings.set(project.editor.beatIds[i],{beat:b,voice:project.cast[b.who]?.voice,audio:project.assets.audio[`line-${line++}`]});}});
 const beat=index=>{if(!Number.isInteger(index)||index<0||index>=p.script.length)throw Error('That scene action no longer exists.');return p.script[index];};
 for(const c of changes){
  if(!c||typeof c!=='object')throw Error('Invalid edit.');
  switch(c.op){
   case 'title':p.meta.title=text(c.text,160);break;
   case 'dialogue':{const b=beat(c.index);if(b.do!=='say')throw Error('Select a dialogue line.');b.line=text(c.text);if(c.who!==undefined){if(!own(p.cast,c.who))throw Error('Choose a character in this skit.');b.who=c.who;}break;}
   case 'pause':{const b=beat(c.index);if(b.do!=='pause')throw Error('Select a pause.');b.duration=number(c.seconds,0,60,'Pause');break;}
   case 'insertPause':{beat(c.after);p.script.splice(c.after+1,0,{do:'pause',duration:number(c.seconds,0,60,'Pause')});p.editor.beatIds.splice(c.after+1,0,id());break;}
   case 'insertDialogue':{beat(c.after);if(!own(p.cast,c.who))throw Error('Choose a character.');p.script.splice(c.after+1,0,{do:'say',who:c.who,line:text(c.text)});p.editor.beatIds.splice(c.after+1,0,id());break;}
   case 'removeBeat':beat(c.index);p.script.splice(c.index,1);p.editor.beatIds.splice(c.index,1);break;
   case 'moveBeat':{beat(c.from);beat(c.to);const [b]=p.script.splice(c.from,1),[key]=p.editor.beatIds.splice(c.from,1);p.script.splice(c.to,0,b);p.editor.beatIds.splice(c.to,0,key);break;}
   case 'position':{if(!own(p.cast,c.character))throw Error('Select a character.');const actor=p.cast[c.character];for(const k of ['x','y','scale'])if(c[k]!==undefined){actor[k]=number(c[k],k==='scale'?0.1:0,k==='scale'?3:100,k);if(k==='x'&&own(actor,'startX'))actor.startX=actor.x;if(k==='y'&&own(actor,'startY'))actor.startY=actor.y;}break;}
   case 'background':if(!own(p.assets.backgrounds,c.name))throw Error('Choose an existing backdrop.');p.stage.background=c.name;{const opening=p.script.find(b=>b.do==='background');if(opening)opening.name=c.name;}break;
   case 'sprite':if(!own(p.assets.sprites,c.name)||typeof c.data!=='string'||!c.data.startsWith('data:image/svg+xml;base64,'))throw Error('Choose an existing SVG character.');p.assets.sprites[c.name]=c.data;break;
   default:throw Error(`The Editor cannot apply “${c.op}”. Ask for dialogue, pause, position, title, background, or sprite edits.`);
  }
 }
 p.assets.audio={};p.audioBindings={};line=0;
 p.script.forEach((b,i)=>{if(b.do!=='say')return;const key=`line-${line++}`,old=recordings.get(p.editor.beatIds[i]);if(old?.audio&&old.beat.line===b.line&&old.beat.who===b.who&&old.voice===p.cast[b.who]?.voice){p.assets.audio[key]=old.audio;p.audioBindings[key]={line:b.line,who:b.who,voice:p.cast[b.who]?.voice};}});
 p.editor.revision=id();return p;
}
export function contextFor(p,selection){
 return {title:p.meta.title,revision:p.editor.revision,selection,stage:p.stage,cast:p.cast,script:p.script,availableSprites:Object.keys(p.assets.sprites),availableBackgrounds:Object.keys(p.assets.backgrounds),voiceNeeds:voiceNeeds(p).map(v=>v.beat.line)};
}
export function copyRequest(p,selection,request){return `Please revise my pelicans.art skit: ${request||'Help me improve this selected part.'}\n\nUse my latest Editor export as the source of truth; I may have made visual edits since your last version. If you do not have it, ask me to attach the exported project JSON. Preserve all unchanged recordings. Regenerate only edited dialogue with the project’s pinned speech profile, validate, and send me a playable video and updated editable bundle.\n\nSelected context:\n${JSON.stringify(contextFor(p,selection),null,2)}`;}
