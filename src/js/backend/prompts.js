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

  function embedMetaInSvgString(svg, meta) {
    if (!svg || typeof svg !== 'string') return svg;
    if (!meta || Object.keys(meta).length === 0) return svg;
    const jsonStr = JSON.stringify(meta).replace(/'/g, '&#39;');
    if (/data-meta='[^']*'/.test(svg)) {
      return svg.replace(/data-meta='[^']*'/, `data-meta='${jsonStr}'`);
    }
    if (/data-meta="[^"]*"/.test(svg)) {
      return svg.replace(/data-meta="[^"]*"/, `data-meta='${jsonStr}'`);
    }
    return svg.replace('<svg', `<svg data-meta='${jsonStr}'`);
  }

  const SPRITE_PROMPT = `You are an SVG character artist creating sprites for animated comedy skits.

CRITICAL REQUIREMENTS:
- Output valid JSON with shape: {"svg":"<svg ...>...</svg>","meta":{...}}
- viewBox must be "0 0 100 150"
- Required element IDs: eye-left-white, eye-right-white, eye-left-pupil, eye-right-pupil, brow-left, brow-right, mouth-open
- Required groups: body, head-top, head-bottom
- Character must face forward and head must connect to body
- Flat cartoon style, bold readable shapes

Metadata requirements in meta object:
- name, description, tags[]
- voice: {id,pitch,speed,volume}

Output only valid JSON.`;

  const PROP_PROMPT = `You are an SVG artist creating props for animated comedy skits.

Requirements:
- Output only SVG
- viewBox must be "0 0 100 100"
- Keep simple flat cartoon style
- centered composition
- no complex filters/gradients
`;

  function buildBackgroundPrompt(orientation = 'landscape') {
    const isPortrait = orientation === 'portrait';
    const width = isPortrait ? 225 : 400;
    const height = isPortrait ? 400 : 225;
    return `You are an SVG scene artist creating skit backgrounds.

REQUIRED DIMENSIONS:
- viewBox="0 0 ${width} ${height}"
- This output is ${isPortrait ? 'portrait' : 'landscape'} orientation.

Style:
- flat cartoon style
- include depth layers
- keep floor space for characters

Output only SVG.`;
  }

  function buildSkitPrompt({ backgrounds = [], sprites = [], props = [] } = {}) {
    const bgList = backgrounds.length
      ? backgrounds.map((b) => `- ${b.name} (${(b.orientations || ['landscape']).join(', ')})`).join('\n')
      : '- none';
    const spriteList = sprites.length ? sprites.map((s) => `- ${s.name || s}`).join('\n') : '- none';
    const propList = props.length ? props.map((p) => `- ${p.name || p}`).join('\n') : '- none';

    return `You are a comedy writer generating short improv skits in JSON.

AVAILABLE BACKGROUNDS:
${bgList}

AVAILABLE SPRITES:
${spriteList}

AVAILABLE PROPS:
${propList}

Output valid JSON with structure:
{
  "meta": { "title": "...", "description": "..." },
  "stage": { "background": "...", "orientation": "landscape" },
  "cast": { "id": { "sprite": "...", "x": 50, "startX": -20 } },
  "props": {},
  "script": [ { "do": "say", "who": "id", "line": "..." } ]
}

Keep runtime under 90s and produce escalating comedic beats.`;
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
    extractMetaFromSvgString,
    embedMetaInSvgString
  };
})(window);
