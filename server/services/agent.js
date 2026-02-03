/**
 * Agent Service - Communicates with OpenClaw for AI-assisted generation
 */

const OPENCLAW_URL = process.env.OPENCLAW_URL || 'http://127.0.0.1:18789';
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN;
const OPENCLAW_AGENT_ID = process.env.OPENCLAW_AGENT_ID || 'skitkit';

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

CRITICAL: mouth-open and mouth-closed MUST be at the same Y position for lip-sync to work.

STYLE GUIDELINES:
- Simple, flat cartoon style suitable for comedy
- Bold colors, clear shapes
- Expressive features that will animate well
- Character should face forward (front view)

Output ONLY the complete SVG element. No explanation, no markdown code blocks, just the raw SVG.`,

  background: `You are an SVG scene artist creating backgrounds for animated comedy skits.

REQUIREMENTS:
- viewBox MUST be "0 0 400 300"
- Simple, flat style suitable for comedy
- Include depth with layers (background, midground, foreground)
- Leave space for characters (they appear in front)
- Avoid complex gradients or patterns that may not render well

SUGGESTED STRUCTURE:
<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <!-- Sky/backdrop -->
  <!-- Midground elements (buildings, trees, etc.) -->
  <!-- Foreground/ground plane -->
</svg>

Output ONLY the complete SVG element. No explanation, no markdown code blocks, just the raw SVG.`,

  skit: `You are a comedy writer creating short animated skits.

OUTPUT FORMAT - Valid JSON with this structure:
{
  "meta": {
    "title": "Skit Title",
    "description": "Brief description"
  },
  "stage": {
    "background": "background-name"
  },
  "cast": {
    "character-id": {
      "sprite": "sprite-name",
      "x": 30,
      "voice": "voice-id"
    }
  },
  "script": [
    { "do": "shot", "type": "wide" },
    { "do": "say", "who": "character-id", "line": "Dialogue here" },
    { "do": "emote", "who": "character-id", "emotion": "happy" }
  ]
}

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

Output ONLY valid JSON. No explanation, no markdown code blocks.`
};

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
  // Try to find SVG in the content
  const svgMatch = content.match(/<svg[\s\S]*?<\/svg>/i);
  if (svgMatch) {
    return svgMatch[0];
  }

  // If no SVG tags found, check if it's wrapped in code blocks
  const codeBlockMatch = content.match(/```(?:xml|svg|html)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    const inner = codeBlockMatch[1].trim();
    const innerSvgMatch = inner.match(/<svg[\s\S]*?<\/svg>/i);
    if (innerSvgMatch) {
      return innerSvgMatch[0];
    }
  }

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
  if (!OPENCLAW_TOKEN) {
    throw new Error('OPENCLAW_TOKEN not configured. Set it in your .env file.');
  }

  const response = await fetch(`${OPENCLAW_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENCLAW_TOKEN}`,
      'Content-Type': 'application/json',
      'x-openclaw-agent-id': OPENCLAW_AGENT_ID
    },
    body: JSON.stringify({
      model: `openclaw:${OPENCLAW_AGENT_ID}`,
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
 * @param {Object} [request.current] - Current asset state (for edit mode)
 * @returns {Promise<Object>} Generated asset
 */
export async function generateAsset(request) {
  const { type, mode, command, current } = request;

  if (!SYSTEM_PROMPTS[type]) {
    throw new Error(`Unknown asset type: ${type}`);
  }

  const systemPrompt = SYSTEM_PROMPTS[type];
  const userPrompt = buildUserPrompt(mode, command, current);

  console.log(`[Agent] Generating ${type} (${mode}): "${command.slice(0, 50)}..."`);

  const content = await callOpenClaw(systemPrompt, userPrompt);

  // Parse response based on type
  if (type === 'skit') {
    const skit = extractJson(content);
    return { skit };
  } else {
    const svg = extractSvg(content);
    return { svg };
  }
}

/**
 * Check if OpenClaw is configured and reachable
 */
export async function checkOpenClawConnection() {
  if (!OPENCLAW_TOKEN) {
    return { connected: false, error: 'OPENCLAW_TOKEN not configured' };
  }

  try {
    // Try a simple request to check connectivity
    const response = await fetch(`${OPENCLAW_URL}/`, {
      headers: {
        'Authorization': `Bearer ${OPENCLAW_TOKEN}`
      }
    });

    return {
      connected: response.ok,
      url: OPENCLAW_URL,
      agentId: OPENCLAW_AGENT_ID
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message,
      url: OPENCLAW_URL
    };
  }
}
