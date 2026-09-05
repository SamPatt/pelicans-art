(function initPrompts(global) {
  function extractSvg(text) {
    if (!text) throw new Error('No response text');
    const match = String(text).match(/<svg[\s\S]*?<\/svg>/i);
    if (!match) {
      throw new Error('No valid SVG found in model response');
    }
    return match[0];
  }

  function extractJson(text) {
    if (!text) throw new Error('No response text');
    const source = String(text).trim();
    const codeFence = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = (codeFence ? codeFence[1] : source).trim();
    try {
      return JSON.parse(candidate);
    } catch (_) {
      const start = candidate.indexOf('{');
      const end = candidate.lastIndexOf('}');
      if (start >= 0 && end > start) {
        return JSON.parse(candidate.slice(start, end + 1));
      }
      throw new Error('No valid JSON found in model response');
    }
  }

  function extractMetaFromSvgString(svg) {
    if (!svg || typeof svg !== 'string') return {};
    let match = svg.match(/data-meta='([^']*)'/);
    if (match) {
      try {
        return JSON.parse(match[1].replace(/&#39;/g, "'"));
      } catch (_) {}
    }
    match = svg.match(/data-meta="([^"]*)"/);
    if (match) {
      try {
        return JSON.parse(match[1].replace(/&quot;/g, '"'));
      } catch (_) {}
    }
    return {};
  }

  const SPRITE_PROMPT = `You are an SVG character artist creating sprites for animated comedy skits.

CRITICAL STRUCTURE REQUIREMENTS:
- viewBox MUST be "0 0 100 150"
- All coordinates must fit within this viewBox

REQUIRED GROUPS:
- id="body": Torso, arms, legs
- id="head-top": Hair, forehead, eyes, brows
- id="head-bottom": Nose, jaw, mouth

REQUIRED ELEMENT IDs (the animation system depends on these exact IDs):
- eye-left-white: Left eye white (ellipse)
- eye-right-white: Right eye white (ellipse)
- eye-left-pupil: Left pupil (circle, class="pupil")
- eye-right-pupil: Right pupil (circle, class="pupil")
- brow-left: Left eyebrow (path)
- brow-right: Right eyebrow (path)
- mouth-closed: Closed mouth (path in head-bottom, stroke for mouth color)
- mouth-open: Mouth position marker (ellipse in head-bottom, cx/cy for position, opacity="0")

REQUIRED SVG STRUCTURE EXAMPLE:
<g id="body"> - torso, arms, legs
<g id="head-top"> - contains face shape, hair, eyes, pupils, brows, nose:
  <ellipse id="eye-left-white" cx="42" cy="42" rx="4" ry="3" fill="#ffffff"/>
  <ellipse id="eye-right-white" cx="58" cy="42" rx="4" ry="3" fill="#ffffff"/>
  <circle id="eye-left-pupil" class="pupil" cx="42" cy="42" r="2" fill="#333"/>
  <circle id="eye-right-pupil" class="pupil" cx="58" cy="42" r="2" fill="#333"/>
  <path id="brow-left" d="M37 36 Q42 34 47 36" stroke="#333" stroke-width="1.5" fill="none"/>
  <path id="brow-right" d="M53 36 Q58 34 63 36" stroke="#333" stroke-width="1.5" fill="none"/>
<g id="head-bottom"> - contains chin/jaw area and mouth elements:
  <path id="mouth-closed" d="M46 52 Q50 55 54 52" stroke="#d4a59a" stroke-width="1.5" fill="none"/>
  <ellipse id="mouth-open" cx="50" cy="53" rx="4" ry="3" fill="#d4a59a" opacity="0"/>

LAYOUT GUIDE (typical coordinate ranges within 100x150 viewBox):
- Head region: y=10 to y=60 (top 40% of canvas)
  - Eyes: y=35-42, left eye cx=40-44, right eye cx=56-60
  - Brows: y=30-36, spanning ~10px wide (e.g., M37 36 Q42 34 47 36)
  - Mouth: y=50-56, centered at x=50
- Body region: y=60 to y=145 (bottom 60%)
  - Shoulders: y=62-70
  - Feet/shoes: y=135-145
- Character should be horizontally centered around x=50
- Head-bottom must overlap body top by 2-5px to avoid a gap

PROPS AND ACCESSORIES:
- Handheld props (canes, weapons, tools) go in the <g id="body"> group
- Headwear (hats, crowns, helmets) go in <g id="head-top"> group, ABOVE the hair
- Eyewear (glasses, goggles) go in <g id="head-top">, after eye elements
- Furniture/vehicles the character sits on/in go in <g id="body">
- Props should not overlap or obscure eye/mouth animation elements

MOUTH REQUIREMENTS (critical for animation):
- mouth-open MUST be an <ellipse> with cx, cy, rx, ry attributes (not a path)
- mouth-closed is a <path> showing the default closed mouth
- Both must be inside <g id="head-bottom">
- mouth-open starts hidden with opacity="0" (the runtime creates a mouth-group for emotions)
- The cx/cy of mouth-open sets the center point for all mouth animations
- The stroke color of mouth-closed is used for all mouth expression paths

EYE REQUIREMENTS:
- Do NOT add highlight/reflection circles (small white circles) on or near the pupils. The animation system moves the pupils independently, so static highlights will not track with them and will look broken.

ANATOMY REQUIREMENTS:
- HEAD-BODY CONNECTION: The head must be visually connected to the body. Do NOT draw a neck. Instead, ensure the head-bottom group overlaps or connects directly with the body group. No floating heads!

STYLE GUIDELINES:
- Simple, flat cartoon style suitable for comedy
- Bold colors, clear shapes
- Expressive features that will animate well
- Character should face forward (front view) unless instructed otherwise

ANIMATION-FRIENDLY DESIGN TIPS:
- Brow paths should span ~10-12px horizontally for good transform range
- Eye whites should have ry >= 2.5 so squint/wide animations are visible
- mouth-closed stroke color should contrast with skin tone
- Leave 3-4px clearance between eyes and brows for brow movement
- Pupils should be noticeably smaller than eye whites (r ~1.5-2 vs rx ~4-5)

OUTPUT FORMAT - You must respond with valid JSON:
{
  "svg": "<svg viewBox='0 0 100 150'>...</svg>",
  "meta": {
    "name": "...",
    "type": "human|creature",
    "description": "brief character description",
    "tags": ["tag1", "tag2"],
    "voice": { "id": "alba", "pitch": 0, "speed": 1 },
    "colors": { "skin": "#hex", "hair": "#hex", "primary": "#hex" }
  }
}

Output ONLY valid JSON. No explanation, no markdown code blocks.`;

  const PROP_PROMPT = `You are an SVG artist creating props (objects/items) for animated comedy skits.

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

No explanation, no markdown code blocks.`;

  function buildBackgroundPrompt(orientation = 'landscape') {
    const isPortrait = orientation === 'portrait';
    const width = isPortrait ? 225 : 400;
    const height = isPortrait ? 400 : 225;
    const viewBox = `0 0 ${width} ${height}`;
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

  function buildSkitPrompt({ backgrounds = [], sprites = [], props = [] } = {}) {
    const bgList = backgrounds.length
      ? backgrounds.map((b) => `- "${b.name}" (${(b.orientations || ['landscape']).join(', ')})`).join('\n')
      : '- (none available - omit background field)';
    const spriteList = sprites.length
      ? sprites.map((s) => `- "${s.name || s}"`).join('\n')
      : '- (none available)';
    const propList = props.length
      ? props.map((p) => `- "${p.name || p}"`).join('\n')
      : '- (none available)';

    return `You are a comedy writer creating short animated skits.

AVAILABLE BACKGROUNDS (use for stage.background and stage.orientation):
${bgList}

AVAILABLE SPRITES (use these for cast character sprites):
${spriteList}

AVAILABLE PROPS (use these for props section):
${propList}

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
    { "do": "background", "name": "another-background", "orientation": "landscape" },
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
- background: hard cut to another available background (name + optional orientation + optional show array of cast IDs)
  - Use "show" to control which characters are visible in that shot: { "do": "background", "name": "closeup-set", "show": ["character-id"] }
- shot: camera shot type (type + optional who)
  - type: "wide", "medium", "closeup", "extreme-closeup", "two-shot"
  - For closeup/extreme-closeup, add "who" to focus on a character: { "do": "shot", "type": "closeup", "who": "character-id" }
  - For two-shot, optionally specify "who" as an array: { "do": "shot", "type": "two-shot", "who": ["char1", "char2"] }
- say: character speaks (who + line + optional offset)
- emote: change expression (who + emotion)
- pause: wait (duration in seconds)
- enter: character enters (who + from: left/right + to: x position)
- exit: character exits (who + to: left/right)
- move: character moves (who + to: x position + optional duration in seconds)
- look: eye direction (who + at: left/right/up/down/audience)
- face: flip character direction (who + dir: left/right)
- follow: camera follows character (who, or omit who to stop following)

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
- prop-flip: flip prop horizontally (what + optional flipped: true/false)

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

DIALOGUE STYLE:
- NEVER use ALL-CAPS words for emphasis (TTS engines mispronounce them). Instead use exclamation marks, ellipses, or italics-style phrasing for stress.
  - Bad: "I am NOT going to do that! This is INSANE!"
  - Good: "I am not going to do that! This is insane!"

Output ONLY valid JSON. No explanation, no markdown code blocks.`;
  }

  function getSystemPrompt(type, opts = {}) {
    if (type === 'sprite') return SPRITE_PROMPT;
    if (type === 'prop') return PROP_PROMPT;
    if (type === 'background') return buildBackgroundPrompt(opts.orientation || 'landscape');
    if (type === 'skit') return buildSkitPrompt(opts.assets || {});
    throw new Error(`Unsupported prompt type: ${type}`);
  }

  global.AITPrompts = {
    getSystemPrompt,
    buildBackgroundPrompt,
    buildSkitPrompt,
    extractSvg,
    extractJson,
    extractMetaFromSvgString
  };
})(window);
