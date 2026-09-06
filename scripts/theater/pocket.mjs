import fs from 'node:fs';
import {createHash} from 'node:crypto';
const raw=fs.readFileSync(new URL('./pocket-profile.json',import.meta.url));
export const pocketProfile=JSON.parse(raw);
export const pocketProfileHash=createHash('sha256').update(JSON.stringify(pocketProfile)).digest('hex');
export function pocketDefaults(){return {engine:'pocket',endpoint:'http://127.0.0.1:8001/tts',model:'pocket-tts-2.1.0/english_2026-04',profile:structuredClone(pocketProfile),profileHash:pocketProfileHash,textPrefix:''};}

export const pocketVoiceCatalog=JSON.parse(fs.readFileSync(new URL('./pocket-voices.json',import.meta.url)));
export function availableVoicePresets(tts){
 const profile=tts?.profile;
 return profile?.voice_repository===pocketVoiceCatalog.repository&&profile?.voice_revision===pocketVoiceCatalog.revision&&profile?.voice_directory===pocketVoiceCatalog.directory
  ? [...pocketVoiceCatalog.voices] : profile?.voices||null;
}
