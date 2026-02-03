import FormData from 'form-data';
import fetch from 'node-fetch';
import {
  getSprite,
  getBackground,
  savePublished
} from './storage.js';

const TTS_URL = process.env.TTS_URL || 'http://127.0.0.1:8001';

/**
 * Generate TTS audio for a line of dialogue
 * @param {string} text - The text to speak
 * @param {string} voice - Voice ID or URL
 * @returns {Promise<Buffer>} Audio buffer
 */
async function generateTTS(text, voice) {
  const paddedText = ', ' + text;

  const formData = new FormData();
  formData.append('text', paddedText);
  formData.append('voice_url', voice);

  const response = await fetch(`${TTS_URL}/tts`, {
    method: 'POST',
    body: formData
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
 * Convert audio buffer to data URL
 */
function audioToDataUrl(buffer) {
  const base64 = buffer.toString('base64');
  return `data:audio/wav;base64,${base64}`;
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
    backgrounds: {},
    audio: {}
  };

  // Calculate total steps
  const spriteNames = new Set(Object.values(skit.cast).map(c => c.sprite));
  const sayActions = skit.script.filter(b => b.do === 'say');
  const totalSteps = spriteNames.size + 1 + sayActions.length;
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
      assets.sprites[`${spriteName}-front`] = svgToDataUrl(sprite.svg);
    } catch (err) {
      console.warn(`Failed to load sprite ${spriteName}:`, err.message);
      // Continue without this sprite
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
    const bgSvg = await getBackground(skit.stage.background);
    assets.backgrounds[skit.stage.background] = svgToDataUrl(bgSvg);
  } catch (err) {
    console.warn(`Failed to load background ${skit.stage.background}:`, err.message);
  }

  // 3. Generate audio for each "say" action
  for (let i = 0; i < sayActions.length; i++) {
    const beat = sayActions[i];
    const char = skit.cast[beat.who];

    if (!char) {
      console.warn(`Unknown character in script: ${beat.who}`);
      continue;
    }

    const voice = char.voice || 'alba';

    currentStep++;
    onProgress?.({
      step: 'audio',
      current: currentStep,
      total: totalSteps,
      detail: `Generating audio: "${beat.line.slice(0, 30)}${beat.line.length > 30 ? '...' : ''}"`
    });

    try {
      const audioBuffer = await generateTTS(beat.line, voice);
      assets.audio[`line-${i}`] = audioToDataUrl(audioBuffer);
    } catch (err) {
      console.warn(`Failed to generate audio for line ${i}:`, err.message);
      // Continue without this audio
    }
  }

  // 4. Bundle everything
  const published = {
    meta: skit.meta,
    stage: skit.stage,
    cast: skit.cast,
    script: skit.script,
    assets,
    publishedAt: new Date().toISOString()
  };

  // 5. Save
  const result = await savePublished(skitId, published);

  return {
    id: skitId,
    url: `/published/${skitId}.json`,
    size: result.size
  };
}
