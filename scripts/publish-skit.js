#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const TTS_URL = 'http://localhost:8001/tts';
const SRC_DIR = path.join(__dirname, '../src');

// Skits to publish
const skits = {
  luckyCharms: {
    meta: { title: "Lucky Charms", duration: 120 },
    stage: { background: "restaurant" },
    cast: {
      waiter: { x: 30, sprite: "waiter", voice: "jean" },
      woman: { x: 70, sprite: "girl", voice: "cosette" },
      leprechaun: { x: -20, sprite: "leprechaun", voice: "marius", startOffscreen: true, scale: 0.6 }
    },
    script: [
      // Setup - everyone looking at each other
      { do: "shot", type: "wide" },
      { do: "look", who: "waiter", at: "right" },
      { do: "look", who: "woman", at: "left" },
      { do: "emote", who: "waiter", emotion: "happy" },
      { do: "emote", who: "woman", emotion: "neutral" },
      { do: "pause", duration: 1 },
      // Dialogue - eyes stay fixed on conversation partner
      { do: "shot", type: "closeup", who: "waiter" },
      { do: "say", who: "waiter", line: "Good evening, madam. May I tell you about our special tonight?" },
      { do: "shot", type: "closeup", who: "woman" },
      { do: "emote", who: "woman", emotion: "happy" },
      { do: "say", who: "woman", line: "Oh yes, please!" },
      { do: "shot", type: "closeup", who: "waiter" },
      { do: "emote", who: "waiter", emotion: "excited" },
      { do: "say", who: "waiter", line: "Tonight we have something truly magical." },
      { do: "shot", type: "closeup", who: "woman" },
      { do: "emote", who: "woman", emotion: "surprised" },
      { do: "say", who: "woman", line: "Magical? In a restaurant?" },
      { do: "shot", type: "extreme-closeup", who: "waiter" },
      { do: "emote", who: "waiter", emotion: "happy" },
      { do: "say", who: "waiter", line: "Lucky Charms. Magically delicious." },
      { do: "shot", type: "extreme-closeup", who: "woman" },
      { do: "emote", who: "woman", emotion: "worried" },
      { do: "say", who: "woman", line: "The... the cereal?" },
      { do: "shot", type: "closeup", who: "waiter" },
      { do: "emote", who: "waiter", emotion: "smug" },
      { do: "say", who: "waiter", line: "Imported directly from General Mills." },
      { do: "shot", type: "closeup", who: "woman" },
      { do: "emote", who: "woman", emotion: "angry" },
      { do: "say", who: "woman", line: "Sir, this is a five star restaurant." },
      { do: "shot", type: "closeup", who: "waiter" },
      { do: "emote", who: "waiter", emotion: "worried" },
      { do: "say", who: "waiter", line: "Yes, and it has five different marshmallow shapes." },
      { do: "shot", type: "closeup", who: "woman" },
      { do: "emote", who: "woman", emotion: "tired" },
      { do: "say", who: "woman", line: "I'd like to speak to the manager." },
      // Waiter exits
      { do: "shot", type: "wide" },
      { do: "emote", who: "waiter", emotion: "sad" },
      { do: "pause", duration: 0.5 },
      { do: "look", who: "waiter", at: "left" },
      { do: "exit", who: "waiter", to: "left" },
      { do: "pause", duration: 1 },
      // Leprechaun enters - woman looks at leprechaun now
      { do: "enter", who: "leprechaun", from: "left", to: 30 },
      { do: "emote", who: "leprechaun", emotion: "happy" },
      { do: "look", who: "leprechaun", at: "right" },
      { do: "look", who: "woman", at: "left" },
      { do: "emote", who: "woman", emotion: "surprised" },
      { do: "pause", duration: 0.5 },
      { do: "shot", type: "closeup", who: "leprechaun" },
      { do: "say", who: "leprechaun", line: "Can I help you?" },
      { do: "shot", type: "wide" },
      { do: "emote", who: "woman", emotion: "angry" },
      { do: "pause", duration: 0.5 },
      { do: "say", who: "leprechaun", line: "What?" },
      { do: "pause", duration: 1 }
    ]
  },
  theInterview: {
    meta: { title: "The Interview", duration: 120 },
    stage: { background: "office" },
    cast: {
      candidate: { x: 30, sprite: "man-suit", voice: "marius", volume: 1.3 },
      cat: { x: 70, sprite: "cat", voice: "cosette" }
    },
    script: [
      { do: "shot", type: "wide" },
      { do: "emote", who: "candidate", emotion: "neutral" },
      { do: "emote", who: "cat", emotion: "neutral" },
      { do: "pause", duration: 1 },
      { do: "shot", type: "closeup", who: "candidate" },
      { do: "emote", who: "candidate", emotion: "happy" },
      { do: "say", who: "candidate", line: "Thank you for meeting with me today." },
      { do: "shot", type: "closeup", who: "cat" },
      { do: "emote", who: "cat", emotion: "neutral" },
      { do: "say", who: "cat", line: "Meow." },
      { do: "shot", type: "closeup", who: "candidate" },
      { do: "emote", who: "candidate", emotion: "happy" },
      { do: "say", who: "candidate", line: "Great question! My biggest strength is attention to detail." },
      { do: "shot", type: "closeup", who: "cat" },
      { do: "emote", who: "cat", emotion: "angry" },
      { do: "say", who: "cat", line: "HISSSSS!" },
      { do: "shot", type: "closeup", who: "candidate" },
      { do: "emote", who: "candidate", emotion: "worried" },
      { do: "say", who: "candidate", line: "Fair point. I'm also very adaptable." },
      { do: "shot", type: "closeup", who: "cat" },
      { do: "emote", who: "cat", emotion: "excited" },
      { do: "say", who: "cat", line: "Meow meow! Purrrrr." },
      { do: "shot", type: "closeup", who: "candidate" },
      { do: "emote", who: "candidate", emotion: "worried" },
      { do: "say", who: "candidate", line: "A ball of yarn? Is this... a negotiation tactic?" },
      { do: "shot", type: "wide" },
      { do: "pause", duration: 0.5 },
      { do: "shot", type: "closeup", who: "candidate" },
      { do: "emote", who: "candidate", emotion: "smug" },
      { do: "say", who: "candidate", line: "Alright. I'll play ball." },
      { do: "shot", type: "closeup", who: "cat" },
      { do: "emote", who: "cat", emotion: "happy" },
      { do: "say", who: "cat", line: "MEOW!" },
      { do: "shot", type: "closeup", who: "candidate" },
      { do: "emote", who: "candidate", emotion: "happy" },
      { do: "say", who: "candidate", line: "I accept your offer." },
      { do: "shot", type: "wide" },
      { do: "pause", duration: 1 }
    ]
  }
};

async function generateTTS(text, voice) {
  const FormData = (await import('form-data')).default;
  const fetch = (await import('node-fetch')).default;
  
  const formData = new FormData();
  formData.append('text', ', ' + text); // Small pause prefix
  formData.append('voice_url', voice);
  
  const res = await fetch(TTS_URL, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`TTS failed: ${res.status}`);
  
  const buffer = await res.buffer();
  return 'data:audio/wav;base64,' + buffer.toString('base64');
}

function loadAsset(filePath) {
  const content = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === '.svg' ? 'image/svg+xml' : 'application/octet-stream';
  return `data:${mimeType};base64,${content.toString('base64')}`;
}

async function publishSkit(name) {
  const skit = skits[name];
  if (!skit) {
    console.error(`Unknown skit: ${name}`);
    process.exit(1);
  }
  
  console.log(`Publishing: ${name}`);
  
  // Load sprites
  const sprites = {};
  for (const [charName, config] of Object.entries(skit.cast)) {
    const spriteName = config.sprite;
    const frontPath = path.join(SRC_DIR, 'sprites', `${spriteName}-front.svg`);
    const backPath = path.join(SRC_DIR, 'sprites', `${spriteName}-back.svg`);
    
    if (fs.existsSync(frontPath)) {
      sprites[`${spriteName}-front`] = loadAsset(frontPath);
      console.log(`  Loaded sprite: ${spriteName}-front`);
    }
    if (fs.existsSync(backPath)) {
      sprites[`${spriteName}-back`] = loadAsset(backPath);
      console.log(`  Loaded sprite: ${spriteName}-back`);
    }
  }
  
  // Load every background used by the editable shot list.
  const backgrounds = {};
  const backgroundRequests = new Map();
  if (skit.stage?.background) backgroundRequests.set(skit.stage.background, skit.stage.orientation || 'landscape');
  for (const beat of skit.script || []) {
    if (beat.do === 'background' && beat.name) backgroundRequests.set(beat.name, beat.orientation || 'landscape');
  }
  for (const [backgroundName, orientation] of backgroundRequests) {
    const nestedPath = path.join(SRC_DIR, 'backgrounds', backgroundName, `${orientation}.svg`);
    const legacyPath = path.join(SRC_DIR, 'backgrounds', `${backgroundName}.svg`);
    const bgPath = fs.existsSync(nestedPath) ? nestedPath : legacyPath;
    if (fs.existsSync(bgPath)) {
      backgrounds[backgroundName] = loadAsset(bgPath);
      console.log(`  Loaded background: ${backgroundName}`);
    }
  }
  
  // Generate audio
  const audio = {};
  const sayActions = skit.script.filter(b => b.do === 'say');
  for (let i = 0; i < sayActions.length; i++) {
    const beat = sayActions[i];
    const char = skit.cast[beat.who];
    console.log(`  Generating audio ${i + 1}/${sayActions.length}: "${beat.line.substring(0, 30)}..."`);
    
    try {
      audio[`line-${i}`] = await generateTTS(beat.line, char.voice);
    } catch (e) {
      console.error(`    Failed: ${e.message}`);
    }
  }
  
  // Build published skit
  const published = {
    meta: skit.meta,
    stage: skit.stage,
    cast: skit.cast,
    script: skit.script,
    assets: { sprites, backgrounds, audio }
  };
  
  // Save
  const outPath = path.join(SRC_DIR, 'published', `${name}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(published, null, 2));
  
  const size = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`  Saved: ${outPath} (${size} KB)`);
}

const skitName = process.argv[2];
if (!skitName) {
  console.log('Usage: node publish-skit.js <skitName>');
  console.log('Available:', Object.keys(skits).join(', '));
  process.exit(1);
}

publishSkit(skitName).catch(e => {
  console.error(e);
  process.exit(1);
});
