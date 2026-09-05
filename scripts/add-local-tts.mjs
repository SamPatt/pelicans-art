#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const options = {
    endpoint: 'http://127.0.0.1:8001/tts',
    voices: new Map()
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--skit') options.skit = argv[++i];
    else if (arg === '--endpoint') options.endpoint = argv[++i];
    else if (arg === '--voice') {
      const assignment = argv[++i] || '';
      const equals = assignment.indexOf('=');
      if (equals < 1) throw new Error('--voice must use character-id=path syntax.');
      options.voices.set(assignment.slice(0, equals), assignment.slice(equals + 1));
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.skit) throw new Error('Usage: add-local-tts.mjs --skit FILE --voice character-id=sample.wav [...]');
  return options;
}

function resolveFromRoot(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT, file);
}

async function synthesize(endpoint, text, voiceSpec) {
  const form = new FormData();
  form.append('text', `, ${text}`);
  if (voiceSpec.startsWith('builtin:')) {
    form.append('voice_url', voiceSpec.slice('builtin:'.length));
  } else {
    const voiceFile = resolveFromRoot(voiceSpec);
    const voice = await fs.readFile(voiceFile);
    form.append('voice_wav', new Blob([voice], { type: 'audio/wav' }), path.basename(voiceFile));
  }
  const response = await fetch(endpoint, { method: 'POST', body: form });
  if (!response.ok) throw new Error(`Local TTS returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length < 44 || audio.subarray(0, 4).toString('ascii') !== 'RIFF') {
    throw new Error('Local TTS did not return a valid WAV file.');
  }
  return audio;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const skitPath = resolveFromRoot(options.skit);
  const skit = JSON.parse(await fs.readFile(skitPath, 'utf8'));
  const sayActions = (skit.script || []).filter((beat) => beat.do === 'say');
  if (!sayActions.length) throw new Error('The skit contains no dialogue.');

  const audio = {};
  for (let i = 0; i < sayActions.length; i += 1) {
    const beat = sayActions[i];
    const configuredVoice = options.voices.get(beat.who);
    if (!configuredVoice) throw new Error(`No local voice assigned to cast member: ${beat.who}`);
    console.log(`[${i + 1}/${sayActions.length}] ${beat.who}: ${beat.line}`);
    const wav = await synthesize(options.endpoint, beat.line, configuredVoice);
    audio[`line-${i}`] = `data:audio/wav;base64,${wav.toString('base64')}`;
  }

  skit.assets = { ...(skit.assets || {}), audio };
  for (const [characterId, voiceSpec] of options.voices) {
    if (!skit.cast?.[characterId]) continue;
    skit.cast[characterId].voice = voiceSpec.startsWith('builtin:')
      ? voiceSpec.slice('builtin:'.length)
      : path.basename(voiceSpec, path.extname(voiceSpec));
  }
  await fs.writeFile(skitPath, `${JSON.stringify(skit, null, 2)}\n`);
  console.log(`Embedded ${sayActions.length} voiced lines in ${path.relative(ROOT, skitPath)}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
