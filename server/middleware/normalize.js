/**
 * Normalization middleware for converting skill-friendly flat payloads
 * to API-native nested format.
 *
 * This allows agents to use simpler payloads while the internal API
 * maintains a consistent nested structure.
 */

/**
 * Normalize sprite payload
 *
 * Skill-friendly format:
 * { name, svg, description, tags, voice, colors }
 *
 * API-native format:
 * { name, svg, meta: { description, tags, voice: { id, ... }, colors } }
 */
export function normalizeSprite(req, res, next) {
  const body = req.body;

  // If already has meta object, pass through (but ensure it exists)
  if (body.meta) {
    body.meta = body.meta || {};
    return next();
  }

  // Normalize flat skill payload to nested API format
  req.body = {
    name: body.name,
    svg: body.svg,
    meta: {
      description: body.description,
      tags: body.tags,
      voice: normalizeVoice(body.voice),
      colors: body.colors,
      animation: body.animation
    }
  };

  // Clean up undefined values
  req.body.meta = cleanObject(req.body.meta);

  next();
}

/**
 * Normalize skit payload
 *
 * Skill-friendly format:
 * { title, description, background, cast, script }
 *
 * API-native format:
 * { meta: { title, description }, stage: { background }, cast, script }
 */
export function normalizeSkit(req, res, next) {
  const body = req.body;

  // If already has meta and stage objects, pass through
  if (body.meta && body.stage) {
    return next();
  }

  // Normalize flat skill payload to nested API format
  req.body = {
    meta: {
      title: body.title || body.meta?.title,
      description: body.description || body.meta?.description,
      duration: body.duration || body.meta?.duration
    },
    stage: {
      background: body.background || body.stage?.background
    },
    cast: body.cast,
    script: body.script
  };

  // Clean up undefined values
  req.body.meta = cleanObject(req.body.meta);
  req.body.stage = cleanObject(req.body.stage);

  next();
}

/**
 * Normalize voice field
 * Accepts either a string (voice ID) or an object { id, pitch, speed, volume }
 */
function normalizeVoice(voice) {
  if (!voice) return undefined;

  if (typeof voice === 'string') {
    return { id: voice };
  }

  return voice;
}

/**
 * Remove undefined values from an object
 */
function cleanObject(obj) {
  if (!obj) return obj;

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }

  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}
