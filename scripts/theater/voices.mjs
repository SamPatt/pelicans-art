import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const catalog=JSON.parse(await fs.readFile(fileURLToPath(new URL('./pocket-voices.json',import.meta.url))));
const labels=JSON.parse(await fs.readFile(fileURLToPath(new URL('../../src/voice-labels.json',import.meta.url))));
export async function availableVoices({endpoint='http://127.0.0.1:8001/tts',select=''}={}){
 const url=new URL(endpoint);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('Use a speech endpoint without URL credentials or query parameters');
 url.pathname=url.pathname.replace(/\/tts\/?$/,'').replace(/\/$/,'')+'/health';
 const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw Error(`Pocket catalog unavailable (HTTP ${response.status}); expected /health voicePresets on the supplied service`);
 const reader=response.body.getReader();let bytes=0;const chunks=[];try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>65536)throw Error('Voice catalog response exceeds 64 KB');chunks.push(value);}}finally{await reader.cancel();}
 const health=JSON.parse(Buffer.concat(chunks));if(health.ok!==true||!Array.isArray(health.voicePresets)||health.profile?.voice_revision!==catalog.revision)throw Error('Speech endpoint does not advertise the pinned April preset catalog');
 const offered=new Set(health.voicePresets.filter(v=>typeof v==='string'));
 const voices=catalog.voices.filter(id=>offered.has(id)).map(id=>({id,description:labels.labels?.[id]?.label||id}));
 const selected=String(select).split(',').map(s=>s.trim()).filter(Boolean),missing=selected.filter(id=>!voices.some(v=>v.id===id));
 return {ok:missing.length===0,endpoint,healthEndpoint:url.href,voiceRevision:catalog.revision,voices,selected,missing,note:'Descriptions are subjective listening notes. Catalog availability is not a synthesis test; the next build verifies actual speech.'};
}
