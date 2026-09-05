#!/usr/bin/env node
// Local Pocket TTS only. No paid speech/model providers or credentials.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'artifacts/description/audio');
await fs.mkdir(dir,{recursive:true});
const lines=JSON.parse(await fs.readFile(path.join(root,'artifacts/description/dialogue.json'),'utf8'));
const endpoint='http://127.0.0.1:8001/tts';
// Distinct, deterministic squelch bursts. Kept outside speech speed processing.
function burst(file, duration, frequency) {
 const rate=24000,n=Math.round(rate*duration), wav=Buffer.alloc(44+n*2);
 wav.write('RIFF');wav.writeUInt32LE(36+n*2,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(n*2,40);
 let seed=17;
 for(let i=0;i<n;i++) {seed=(Math.imul(seed,1664525)+1013904223)>>>0;const envelope=Math.sin(Math.PI*i/n)**.65;const sample=((seed/4294967296-.5)*.25+Math.sin(i/rate*2*Math.PI*frequency)*.075)*envelope;wav.writeInt16LE(Math.round(sample*32767),44+i*2);}
 return fs.writeFile(file,wav);
}
await burst(path.join(dir,'squelch-in.wav'),.40,1450);
await burst(path.join(dir,'squelch-out.wav'),.28,950);
const trim='silenceremove=start_periods=1:start_duration=0.01:start_threshold=-54dB:start_silence=0.15,areverse,silenceremove=start_periods=1:start_duration=0.01:start_threshold=-54dB:start_silence=0.15,areverse';
for(const line of lines) {
 const pelican=line.voice==='marius';
 const raw=path.join(dir,`line-${line.index}${line.index===0?'-v4':[1,2].includes(line.index)?'-v3':pelican?'-v2':''}-raw.wav`), dest=path.join(dir,`line-${line.index}.mp3`);
 let cached=true;try{await fs.access(raw);}catch{cached=false;}
 if(!cached) {
  console.log(`Local TTS ${line.index+1}/${lines.length}: ${line.line}`);
  const form=new FormData();form.append('text',pelican?`, ${line.line}`:line.line);form.append('voice_url',line.voice);
  const response=await fetch(endpoint,{method:'POST',body:form});
  if(!response.ok)throw new Error(`Pocket TTS ${response.status}: ${await response.text()}`);
  const wav=Buffer.from(await response.arrayBuffer());if(wav.toString('ascii',0,4)!=='RIFF')throw new Error('Invalid local TTS response');
  await fs.writeFile(raw,wav);
 }
 const common=['-hide_banner','-loglevel','error','-y','-i',raw];
 if(line.radio) {
  execFileSync('ffmpeg',[...common,'-i',path.join(dir,'squelch-in.wav'),'-i',path.join(dir,'squelch-out.wav'),'-filter_complex',`[0:a]${trim},atempo=1.23,highpass=f=420,lowpass=f=2900,acompressor=threshold=0.1:ratio=3:attack=5:release=60,loudnorm=I=-19:TP=-3:LRA=7,aresample=24000,aformat=sample_fmts=fltp:channel_layouts=mono[speech];[1:a]aformat=sample_fmts=fltp:channel_layouts=mono,apad=pad_dur=0.12[pre];[2:a]aformat=sample_fmts=fltp:channel_layouts=mono[post];[pre][speech][post]concat=n=3:v=0:a=1[transmission];anoisesrc=color=white:amplitude=0.028:sample_rate=24000:seed=741,highpass=f=1000,lowpass=f=5000[static];[transmission][static]amix=inputs=2:duration=first:normalize=0[out]`,'-map','[out]','-ar','24000','-ac','1','-c:a','libmp3lame','-b:a','96k',dest]);
 } else {
  execFileSync('ffmpeg',[...common,'-af',`${trim},atempo=${pelican ? 0.82 : 1.12},adelay=140,loudnorm=I=-18:TP=-2:LRA=8,apad=pad_dur=0.15`,'-ar','24000','-ac','1','-c:a','libmp3lame','-b:a','96k',dest]);
 }
 console.log(`Prepared ${line.index}: ${line.radio?'scanner':'clean'} voice.`);
}
execFileSync(process.execPath,[path.join(root,'scripts/build-description.mjs')],{stdio:'inherit'});
