import { spawn } from 'child_process';
import FormData from 'form-data';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import {
  getSprite,
  getSpriteVariant,
  listSpriteVariants,
  getBackground,
  getProp,
  savePublished,
  getVoicePath,
  voiceFileExists,
  getVoiceFileInfo
} from './storage.js';

const TTS_URL = process.env.TTS_URL || 'http://127.0.0.1:8001';
const PORT = process.env.PORT || 3000;

export function resolveVoice(character, spriteMeta) {
  return character?.voice || spriteMeta?.voice?.id || 'alba';
}

/**
 * Generate TTS audio for a line of dialogue
 * @param {string} text - The text to speak
 * @param {string} voice - Voice ID or URL (custom voices prefixed with 'custom:')
 * @returns {Promise<Buffer>} Audio buffer
 */
async function generateTTS(text, voice) {
  const paddedText = ', ' + text;

  // Handle custom voices (prefixed with 'custom:')
  let voiceUrl = voice;
  let useWavUpload = false;
  let wavBuffer = null;

  if (voice && voice.startsWith('custom:')) {
    const customVoiceName = voice.replace('custom:', '');
    // Validate voice name to prevent path traversal
    if (!customVoiceName || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(customVoiceName)) {
      throw new Error(`Invalid custom voice name: ${customVoiceName}`);
    }
    if (!await voiceFileExists(customVoiceName)) {
      throw new Error(`Custom voice not found: ${customVoiceName}`);
    }

    // Check which file type exists (prefer WAV since user chose it as winner)
    const fileInfo = await getVoiceFileInfo(customVoiceName);
    if (fileInfo.type === 'wav') {
      // Use direct WAV upload for better quality
      useWavUpload = true;
      wavBuffer = await fs.readFile(fileInfo.path);
    } else {
      // Use safetensors URL - must end with .safetensors for pocket-tts
      voiceUrl = `http://127.0.0.1:${PORT}/api/voice/${customVoiceName}/voice.safetensors`;
    }
  }

  const formData = new FormData();
  formData.append('text', paddedText);

  if (useWavUpload && wavBuffer) {
    formData.append('voice_wav', wavBuffer, {
      filename: 'voice.wav',
      contentType: 'audio/wav'
    });
  } else {
    formData.append('voice_url', voiceUrl);
  }

  const response = await fetch(`${TTS_URL}/tts`, {
    method: 'POST',
    body: formData,
    headers: formData.getHeaders()
  });

  if (!response.ok) {
    throw new Error(`TTS failed: ${response.status}`);
  }

  return response.buffer();
}

/**
 * Convert SVG to data URL
 */
function svgToDataUrl(svg) {
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Convert WAV buffer to MP3 using ffmpeg
 */
function wavToMp3(wavBuffer) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', 'pipe:0',
      '-f', 'mp3',
      '-ab', '64k',
      '-ac', '1',
      'pipe:1'
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    const chunks = [];
    ffmpeg.stdout.on('data', chunk => chunks.push(chunk));
    ffmpeg.stderr.on('data', () => {}); // suppress ffmpeg logs
    ffmpeg.on('close', code => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
    ffmpeg.on('error', reject);
    ffmpeg.stdin.write(wavBuffer);
    ffmpeg.stdin.end();
  });
}

/**
 * Convert audio buffer to MP3 data URL
 */
async function audioToDataUrl(wavBuffer) {
  const mp3Buffer = await wavToMp3(wavBuffer);
  const base64 = mp3Buffer.toString('base64');
  return `data:audio/mpeg;base64,${base64}`;
}

/**
 * Publish a skit to a self-contained JSON file
 *
 * @param {string} skitId - Skit ID
 * @param {object} skit - Skit data
 * @param {function} onProgress - Progress callback({ step, current, total, detail })
 * @returns {Promise<{ id, url, size }>}
 */
export async function publishSkit(skitId, skit, onProgress) {
  const assets = {
    sprites: {},
    spriteMeta: {},
    backgrounds: {},
    props: {},
    propMeta: {},
    audio: {}
  };

  // Track failures for reporting
  const failures = [];

  // Calculate total steps
  const spriteNames = new Set(Object.values(skit.cast).map(c => c.sprite));
  const propNames = new Set(
    Object.values(skit.props || {}).map(p => p.prop).filter(Boolean)
  );
  const sayActions = skit.script.filter(b => b.do === 'say');
  const totalSteps = spriteNames.size + 1 + propNames.size + sayActions.length;
  let currentStep = 0;

  // 1. Bundle sprites
  for (const spriteName of spriteNames) {
    currentStep++;
    onProgress?.({
      step: 'sprites',
      current: currentStep,
      total: totalSteps,
      detail: `Loading sprite: ${spriteName}`
    });

    try {
      const sprite = await getSprite(spriteName);
      const variants = await listSpriteVariants(spriteName);
      if (!variants.length) {
        assets.sprites[`${spriteName}-front`] = svgToDataUrl(sprite.svg);
      } else {
        for (const variantName of variants) {
          const svg = await getSpriteVariant(spriteName, variantName);
          assets.sprites[`${spriteName}-${variantName}`] = svgToDataUrl(svg);
        }
      }
      if (sprite.meta) assets.spriteMeta[spriteName] = sprite.meta;
    } catch (err) {
      console.warn(`Failed to load sprite ${spriteName}:`, err.message);
      failures.push({ type: 'sprite', name: spriteName, error: err.message });
    }
  }

  // 2. Bundle background
  currentStep++;
  onProgress?.({
    step: 'background',
    current: currentStep,
    total: totalSteps,
    detail: `Loading background: ${skit.stage.background}`
  });

  try {
    const bgOrientation = skit.stage.orientation || 'landscape';
    const bgSvg = await getBackground(skit.stage.background, bgOrientation);
    assets.backgrounds[skit.stage.background] = svgToDataUrl(bgSvg);
  } catch (err) {
    console.warn(`Failed to load background ${skit.stage.background}:`, err.message);
    failures.push({ type: 'background', name: skit.stage.background, error: err.message });
  }

  // 3. Bundle props
  for (const propName of propNames) {
    currentStep++;
    onProgress?.({
      step: 'props',
      current: currentStep,
      total: totalSteps,
      detail: `Loading prop: ${propName}`
    });

    try {
      const prop = await getProp(propName);
      assets.props[propName] = svgToDataUrl(prop.svg);
      if (prop.meta) assets.propMeta[propName] = prop.meta;
    } catch (err) {
      console.warn(`Failed to load prop ${propName}:`, err.message);
      failures.push({ type: 'prop', name: propName, error: err.message });
    }
  }

  // 4. Generate audio for each "say" action
  for (let i = 0; i < sayActions.length; i++) {
    const beat = sayActions[i];
    const char = skit.cast[beat.who];

    if (!char) {
      console.warn(`Unknown character in script: ${beat.who}`);
      failures.push({ type: 'audio', line: i, error: `Unknown character: ${beat.who}` });
      continue;
    }

    const spriteMeta = assets.spriteMeta[char.sprite];
    // A skit's casting choice should override the sprite's default voice.
    const voice = resolveVoice(char, spriteMeta);

    currentStep++;
    onProgress?.({
      step: 'audio',
      current: currentStep,
      total: totalSteps,
      detail: `Generating audio: "${beat.line.slice(0, 30)}${beat.line.length > 30 ? '...' : ''}"`
    });

    try {
      const audioBuffer = await generateTTS(beat.line, voice);
      assets.audio[`line-${i}`] = await audioToDataUrl(audioBuffer);
    } catch (err) {
      console.warn(`Failed to generate audio for line ${i}:`, err.message);
      failures.push({ type: 'audio', line: i, error: err.message });
    }
  }

  // 5. Bundle everything
  const published = {
    meta: skit.meta,
    stage: skit.stage,
    cast: skit.cast,
    props: skit.props || {},
    script: skit.script,
    assets,
    publishedAt: new Date().toISOString()
  };

  // 6. Save
  const result = await savePublished(skitId, published);

  return {
    id: skitId,
    url: `/published/${skitId}.json`,
    size: result.size,
    failures: failures.length > 0 ? failures : undefined,
    complete: failures.length === 0
  };
}
