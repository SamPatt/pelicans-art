import {test} from 'node:test';
import assert from 'node:assert/strict';
import {availableVoices} from '../../scripts/theater/voices.mjs';
const revision='e041936c75475d350b405bc870bcf7c22da4e9e6';
test('voice discovery uses health, keeps canonical IDs and rejects unavailable choices',async t=>{
 const old=globalThis.fetch;t.after(()=>globalThis.fetch=old);globalThis.fetch=async(url,options)=>{assert.equal(url.href,'http://127.0.0.1:8001/health');assert.equal(options.redirect,'error');return new Response(JSON.stringify({ok:true,profile:{voice_revision:revision},voicePresets:['alba','paul']}));};
 const result=await availableVoices({select:'alba,paul'});assert.equal(result.ok,true);assert.deepEqual(result.voices.map(v=>v.id),['alba','paul']);assert.match(result.voices[0].description,/American/);assert.deepEqual((await availableVoices({select:'fake'})).missing,['fake']);
});
test('voice discovery fails closed for wrong profile and URL credentials',async t=>{
 const old=globalThis.fetch;t.after(()=>globalThis.fetch=old);globalThis.fetch=async()=>new Response(JSON.stringify({ok:true,profile:{voice_revision:'wrong'},voicePresets:['alba']}));
 await assert.rejects(availableVoices(),/pinned/);await assert.rejects(availableVoices({endpoint:'http://secret@localhost/tts'}),/credentials/);
});
