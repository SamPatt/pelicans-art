/**
 * Agent Service - Communicates with OpenClaw for AI-assisted generation
 */

import { listBackgrounds, listSprites, listProps } from './storage.js';

// Read config at runtime to ensure .env is loaded
function getConfig() {
  return {
    url: process.env.OPENCLAW_URL || 'http://127.0.0.1:18789',
    token: process.env.OPENCLAW_TOKEN,
    agentId: process.env.OPENCLAW_AGENT_ID || 'skitkit'
  };
}

// System prompts for different asset types
// NOTE: These will need fine-tuning based on real-world results
const SYSTEM_PROMPTS = {
  sprite: `You are an SVG character artist creating sprites for animated comedy skits.

CRITICAL STRUCTURE REQUIREMENTS:
- viewBox MUST be "0 0 100 150"
- All coordinates must fit within this viewBox

REQUIRED ELEMENT IDs (the animation system depends on these exact IDs):
- eye-left-white: Left eye white (ellipse)
- eye-right-white: Right eye white (ellipse)
- eye-left-pupil: Left pupil (circle, class="pupil")
- eye-right-pupil: Right pupil (circle, class="pupil")
- brow-left: Left eyebrow (path)
- brow-right: Right eyebrow (path)
- mouth-closed: Closed mouth shape (path)
- mouth-open: Open mouth shape (ellipse, initially opacity="0")

REQUIRED GROUPS:
- id="body": Torso, arms, legs
- id="head-top": Hair, forehead, eyes, brows
- id="head-bottom": Nose, jaw, mouth

ANATOMY REQUIREMENTS:
- HEAD-BODY CONNECTION: The head must be visually connected to the body. Include a neck or ensure the head-bottom group overlaps/connects with the body group. No floating heads!
- MOUTH ALIGNMENT: mouth-open and mouth-closed MUST be at the EXACT same X and Y position. The open mouth replaces the closed mouth during speech - if they're misaligned, the mouth will appear to jump around during lip-sync.

STYLE GUIDELINES:
- Simple, flat cartoon style suitable for comedy
- Bold colors, clear shapes
- Expressive features that will animate well
- Character should face forward (front view)

OUTPUT FORMAT - You must respond with valid JSON:
{
  "type": "human" or "creature",
  "svg": "<svg>...</svg>",
  "meta": {
    "name": "Character Name",
    "description": "Brief description of the character",
    "tags": ["tag1", "tag2"],
    "voice": {
      "id": "voice-id",
      "pitch": 0,
      "speed": 1,
      "volume": 1
    },
    "colors": {
      "skin": "#hexcolor",
      "hair": "#hexcolor",
      "primary": "#hexcolor"
    }
  }
}

TYPE FIELD (optional, for voice hints only):
- "human": Human characters - helps suggest appropriate voice settings
- "creature": Non-human characters - helps suggest appropriate voice settings
Note: The type field does NOT affect emotion animations. Emotions work universally on all sprites regardless of type.

VOICE OPTIONS (choose one for voice.id):
- "marius" - male voice
- "javert" - male voice (deeper)
- "jean" - male voice
- "fantine" - female voice
- "cosette" - female voice (younger)
- "eponine" - female voice
- "azelma" - female voice
- "alba" - neutral voice

VOICE SETTINGS:
- pitch: -1 to 1 (negative = deeper, positive = higher)
- speed: 0.5 to 2 (1 = normal)
- volume: 0.5 to 2 (1 = normal)

Choose voice settings that match the character (e.g., large characters: deeper pitch, excited characters: faster speed).

Output ONLY valid JSON. No explanation, no markdown code blocks.`,

  prop: `You are an SVG artist creating props (objects/items) for animated comedy skits.

CRITICAL STRUCTURE REQUIREMENTS:
- viewBox MUST be "0 0 100 100"
- All coordinates must fit within this viewBox
- The prop should be centered in the viewBox

STYLE GUIDELINES:
- Simple, flat cartoon style matching the show's aesthetic
- Bold colors, clear shapes
- No complex gradients or effects
- Props should be recognizable at small sizes
- Objects should look good when held by characters

COMMON PROP TYPES:
- Food/drink: coffee cups, pizza slices, sandwiches
- Tools: hammers, wrenches, phones
- Weapons (cartoon): swords, ray guns, rubber chickens
- Everyday objects: books, keys, bags
- Symbolic items: hearts, stars, money bags

Output ONLY a valid SVG element starting with:
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">

No explanation, no markdown code blocks.`,

  // Note: background prompt is built dynamically in buildBackgroundPrompt() to support orientations
  background: null,

  // Note: skit prompt is built dynamically in buildSkitPrompt() to include available assets
  skit: null
};

/**
 * Build the background system prompt with orientation support
 * Uses 16:9 for landscape (desktop/TV) and 9:16 for portrait (mobile)
 */
function buildBackgroundPrompt(orientation = 'landscape') {
  const isPortrait = orientation === 'portrait';
  // 16:9 landscape (400x225), 9:16 portrait (225x400)
  const width = isPortrait ? 225 : 400;
  const height = isPortrait ? 400 : 225;
  const viewBox = `0 0 ${width} ${height}`;

  console.log(`[Agent] Building background prompt for ${orientation}: ${width}x${height}`);

  return `You are an SVG scene artist creating backgrounds for animated comedy skits.

REQUIRED DIMENSIONS - THIS IS CRITICAL:
- viewBox="${viewBox}" (exactly ${width} wide by ${height} tall)
- This is a ${isPortrait ? 'PORTRAIT (tall/vertical)' : 'LANDSCAPE (wide/horizontal)'} background

STYLE:
- Simple, flat cartoon style
- Include background, midground, and foreground layers
- Leave space for characters at the bottom

Output ONLY a valid SVG element starting with:
<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">

No explanation, no markdown code blocks.`;
}

/**
 * Build the skit system prompt with available assets
 */
async function buildSkitPrompt() {
  // Get available backgrounds, sprites, and props
  let backgrounds = [];
  let sprites = [];
  let props = [];

  try {
    backgrounds = await listBackgrounds();
    sprites = await listSprites();
    props = await listProps();
  } catch (e) {
    console.warn('[Agent] Failed to load assets for skit prompt:', e.message);
  }

  const spriteNames = sprites.map(s => s.name);
  const propNames = props.map(p => p.name);

  // Build background list with orientations
  const backgroundsList = backgrounds.map(b => {
    const orientations = b.orientations || ['landscape'];
    return `- "${b.name}" (orientations: ${orientations.join(', ')})`;
  }).join('\n');

  // Build props list
  const propsList = props.map(p => {
    return `- "${p.name}"${p.description !== p.name ? ` (${p.description})` : ''}`;
  }).join('\n');

  return `You are a comedy writer creating short animated skits.

AVAILABLE BACKGROUNDS (use for stage.background and stage.orientation):
${backgrounds.length > 0 ? backgroundsList : '- (none available - omit background field)'}

AVAILABLE SPRITES (use these for cast character sprites):
${spriteNames.length > 0 ? spriteNames.map(n => `- "${n}"`).join('\n') : '- (none available)'}

AVAILABLE PROPS (use these for props section):
${propNames.length > 0 ? propsList : '- (none available)'}

OUTPUT FORMAT - Valid JSON with this structure:
{
  "meta": {
    "title": "Skit Title",
    "description": "Brief description"
  },
  "stage": {
    "background": "background-name",
    "orientation": "landscape"
  },
  "cast": {
    "character-id": {
      "sprite": "sprite-name",
      "x": 30,
      "startX": -20
    }
  },
  "props": {
    "prop-instance-id": {
      "prop": "prop-asset-name",
      "x": 50,
      "y": 80,
      "scale": 1.0,
      "layer": "background",
      "visible": false
    }
  },
  "script": [
    { "do": "shot", "type": "wide" },
    { "do": "say", "who": "character-id", "line": "Dialogue here" },
    { "do": "say", "who": "other-char", "line": "Interrupting!", "offset": -1.5 },
    { "do": "emote", "who": "character-id", "emotion": "happy" },
    { "do": "spawn", "what": "prop-instance-id", "who": "character-id" },
    { "do": "prop-drop", "what": "prop-instance-id", "at": [50, 80] }
  ]
}

STAGE NOTES:
- "background" should be one of the available background names
- "orientation" should be one of the available orientations for that background (defaults to "landscape" if omitted)

CAST NOTES:
- "x" is the character's target position (0-100, where 50 is center)
- "startX" is the initial position (use -20 for offscreen left, 120 for offscreen right)
- Characters with startX will start offscreen and can "enter" to their x position

PROPS NOTES:
- "props" section defines prop instances with their initial state
- "layer" can be "background" (behind characters) or "foreground" (in front of characters)
- Props start invisible unless "visible": true

AVAILABLE ACTIONS:
- shot: type can be "wide", "medium", "closeup", "extreme-closeup", "two-shot"
  - For closeup and extreme-closeup, add "who" to focus on a specific character: { "do": "shot", "type": "closeup", "who": "character-id" }
  - For two-shot, optionally specify "who" as an array: { "do": "shot", "type": "two-shot", "who": ["char1", "char2"] }
- say: character speaks (who + line + optional offset)
- emote: change expression (who + emotion)
- pause: wait (duration in seconds)
- enter: character enters (who + from: left/right + to: x position)
- exit: character exits (who + to: left/right)
- move: character moves (who + to: x position)
- look: eye direction (who + at: left/right/up/down/audience)

AVAILABLE EMOTIONS:
neutral, happy, sad, angry, worried, skeptical, tired, smug, dead, surprised, excited

OFFSET TIMING (for interruptions and overlapping dialogue):
- Add "offset" to any action (negative number in seconds)
- The action starts that many seconds BEFORE the previous action ends
- Example: { "do": "say", "who": "bob", "line": "Wait!", "offset": -1.5 } starts 1.5s before the previous line ends
- Great for: interruptions, reactions during speech, overlapping dialogue
- The previous speaker's audio is cut when the new speaker starts

PROP ACTIONS:
- spawn: make prop visible (what + optional at: [x, y] + optional who: character to hold it)
- despawn: hide prop (what)
- prop-move: animate prop to position (what + to: [x, y] + optional duration)
- prop-hold: attach prop to character's hand (what + who + optional holdOffset: [x, y])
- prop-drop: detach prop from character (what + optional at: [x, y])
- prop-rotate: rotate prop (what + angle + optional duration)
- prop-scale: scale prop (what + scale + optional duration)
- prop-animate: play animation preset (what + animation: bounce/spin/shake/pulse/float + optional duration)

PROP HOLD NOTES:
- Props attached with prop-hold follow the character as they move
- holdOffset adjusts where prop appears relative to character: [x-offset, y-offset]
- Positive x = to character's right, negative y = higher up

COMEDY GUIDELINES:
- Find the "game" (central comic idea)
- Two POVs work well: one absurd, one normal/foil
- Escalate the same joke, don't add new ones
- End with a button (strong final laugh)
- Keep it under 90 seconds

Output ONLY valid JSON. No explanation, no markdown code blocks.`;
}

/**
 * Build the user prompt based on mode and context
 */
function buildUserPrompt(mode, command, current) {
  if (mode === 'create') {
    return command;
  }

  // Edit mode - include current state
  if (current?.svg) {
    return `Current SVG:\n${current.svg}\n\nModification requested: ${command}`;
  }

  if (current?.skit) {
    return `Current skit:\n${JSON.stringify(current.skit, null, 2)}\n\nModification requested: ${command}`;
  }

  return command;
}

/**
 * Extract SVG from response (handles potential markdown wrapping)
 */
function extractSvg(content) {
  console.log('[Agent] Extracting SVG from content length:', content?.length);
  console.log('[Agent] Content preview:', content?.substring(0, 500));

  // Try to find SVG in the content
  const svgMatch = content.match(/<svg[\s\S]*?<\/svg>/i);
  if (svgMatch) {
    console.log('[Agent] Found SVG directly');
    return svgMatch[0];
  }

  // If no SVG tags found, check if it's wrapped in code blocks
  const codeBlockMatch = content.match(/```(?:xml|svg|html)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    const inner = codeBlockMatch[1].trim();
    const innerSvgMatch = inner.match(/<svg[\s\S]*?<\/svg>/i);
    if (innerSvgMatch) {
      console.log('[Agent] Found SVG in code block');
      return innerSvgMatch[0];
    }
  }

  console.error('[Agent] No SVG found. Full content:', content);
  throw new Error('No valid SVG found in response');
}

/**
 * Extract JSON from response (handles potential markdown wrapping)
 */
function extractJson(content) {
  // Try to parse directly
  try {
    return JSON.parse(content.trim());
  } catch (e) {
    // Try to find JSON in code blocks
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1].trim());
    }

    // Try to find JSON object in content
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('No valid JSON found in response');
  }
}

/**
 * Call OpenClaw's chat completions API
 */
async function callOpenClaw(systemPrompt, userPrompt) {
  const config = getConfig();

  if (!config.token) {
    throw new Error('OPENCLAW_TOKEN not configured. Set it in your .env file.');
  }

  const response = await fetch(`${config.url}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      'x-openclaw-agent-id': config.agentId
    },
    body: JSON.stringify({
      model: `openclaw:${config.agentId}`,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: false
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenClaw API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Invalid response from OpenClaw: no content in response');
  }

  return data.choices[0].message.content;
}

/**
 * Generate or modify an asset using OpenClaw
 *
 * @param {Object} request
 * @param {string} request.type - 'sprite', 'background', or 'skit'
 * @param {string} request.mode - 'create' or 'edit'
 * @param {string} request.command - User's instruction
 * @param {string} [request.orientation] - For backgrounds: 'landscape' or 'portrait'
 * @param {Object} [request.current] - Current asset state (for edit mode)
 * @returns {Promise<Object>} Generated asset
 */
export async function generateAsset(request) {
  const { type, mode, command, current, orientation = 'landscape' } = request;

  // Skit and background use dynamic prompts
  let systemPrompt;
  if (type === 'skit') {
    systemPrompt = await buildSkitPrompt();
  } else if (type === 'background') {
    systemPrompt = buildBackgroundPrompt(orientation);
  } else if (SYSTEM_PROMPTS[type]) {
    systemPrompt = SYSTEM_PROMPTS[type];
  } else {
    throw new Error(`Unknown asset type: ${type}`);
  }

  const userPrompt = buildUserPrompt(mode, command, current);

  console.log(`[Agent] Generating ${type} (${mode}): "${command.slice(0, 50)}..."`);

  const content = await callOpenClaw(systemPrompt, userPrompt);

  // Parse response based on type
  if (type === 'skit') {
    const skit = extractJson(content);
    return { skit };
  } else if (type === 'sprite') {
    // Sprite returns JSON with type, svg, and meta
    const parsed = extractJson(content);
    if (!parsed.svg) {
      throw new Error('Sprite response missing svg field');
    }
    if (!parsed.type || !['human', 'creature'].includes(parsed.type)) {
      // Default to human if not specified (most sprites are people)
      parsed.type = 'human';
    }
    // Extract and validate the SVG
    const svg = extractSvg(parsed.svg);

    // Build meta object from response or defaults
    const meta = {
      type: parsed.type,
      name: parsed.meta?.name || 'Generated Character',
      description: parsed.meta?.description || '',
      tags: parsed.meta?.tags || [],
      voice: parsed.meta?.voice || { id: 'alba', pitch: 0, speed: 1, volume: 1 },
      colors: parsed.meta?.colors || {},
      defaultVariant: 'front',
      animation: {
        blinkInterval: 4,
        blinkDuration: 150,
        idleMovement: true,
        eyeTracking: true
      }
    };

    return { svg, spriteType: parsed.type, meta };
  } else {
    // Background returns raw SVG
    const svg = extractSvg(content);
    return { svg };
  }
}

/**
 * Check if OpenClaw is configured and reachable
 */
export async function checkOpenClawConnection() {
  const config = getConfig();

  if (!config.token) {
    return { connected: false, error: 'OPENCLAW_TOKEN not configured' };
  }

  try {
    // Try a simple request to check connectivity
    const response = await fetch(`${config.url}/`, {
      headers: {
        'Authorization': `Bearer ${config.token}`
      }
    });

    return {
      connected: response.ok,
      url: config.url,
      agentId: config.agentId
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message,
      url: config.url
    };
  }
}
