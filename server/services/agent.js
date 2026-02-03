/**
 * Agent Service - Communicates with OpenClaw for AI-assisted generation
 */

import { listBackgrounds, listSprites } from './storage.js';

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
  "svg": "<svg>...</svg>"
}

TYPE GUIDELINES:
- "human": Human characters (people, occupations like doctor/chef/teacher, named individuals)
- "creature": Non-human characters (animals, robots, aliens, monsters, fantasy beings, objects with faces)

Output ONLY valid JSON with type and svg. No explanation, no markdown code blocks.`,

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
  // Get available backgrounds and sprites
  let backgrounds = [];
  let sprites = [];

  try {
    backgrounds = await listBackgrounds();
    sprites = await listSprites();
  } catch (e) {
    console.warn('[Agent] Failed to load assets for skit prompt:', e.message);
  }

  const spriteNames = sprites.map(s => s.name);

  // Build background list with orientations
  const backgroundsList = backgrounds.map(b => {
    const orientations = b.orientations || ['landscape'];
    return `- "${b.name}" (orientations: ${orientations.join(', ')})`;
  }).join('\n');

  return `You are a comedy writer creating short animated skits.

CRITICAL: For the "voice" field in cast, you MUST use ONLY these exact voice IDs:
- "marius" - male voice
- "javert" - male voice (deeper)
- "jean" - male voice
- "fantine" - female voice
- "cosette" - female voice (younger)
- "eponine" - female voice
- "azelma" - female voice
- "alba" - neutral voice

Do NOT use any other voice names like "onyx", "shimmer", "echo", etc. They will not work.

AVAILABLE BACKGROUNDS (use for stage.background and stage.orientation):
${backgrounds.length > 0 ? backgroundsList : '- (none available - omit background field)'}

AVAILABLE SPRITES (use these for cast character sprites):
${spriteNames.length > 0 ? spriteNames.map(n => `- "${n}"`).join('\n') : '- (none available)'}

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
      "voice": "marius"
    }
  },
  "script": [
    { "do": "shot", "type": "wide" },
    { "do": "say", "who": "character-id", "line": "Dialogue here" },
    { "do": "emote", "who": "character-id", "emotion": "happy" }
  ]
}

STAGE NOTES:
- "background" should be one of the available background names
- "orientation" should be one of the available orientations for that background (defaults to "landscape" if omitted)

AVAILABLE ACTIONS:
- shot: type can be "wide", "medium", "closeup", "extreme-closeup", "two-shot"
- say: character speaks (who + line)
- emote: change expression (who + emotion: neutral/happy/sad/angry/surprised/worried/excited/smug/tired)
- pause: wait (duration in seconds)
- enter: character enters (who + from: left/right + to: x position)
- exit: character exits (who + to: left/right)
- move: character moves (who + to: x position)
- look: eye direction (who + at: left/right/up/down/audience)

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
    // Sprite returns JSON with type and svg
    const parsed = extractJson(content);
    if (!parsed.svg) {
      throw new Error('Sprite response missing svg field');
    }
    if (!parsed.type || !['human', 'creature'].includes(parsed.type)) {
      // Default to creature if not specified
      parsed.type = 'creature';
    }
    // Extract and validate the SVG
    const svg = extractSvg(parsed.svg);
    return { svg, spriteType: parsed.type };
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
