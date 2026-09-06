import { assetMetadata } from './asset-metadata.js';
import { renderSharePage } from './share-page.js';
// Pelicans.art Community Worker — Cloudflare Worker with R2 storage

const CATEGORIES = ['characters', 'props', 'backgrounds', 'skits', 'published', 'voices'];
const MAX_PAYLOAD = 3 * 1024 * 1024; // 3MB
const USERNAME_RE = /^[a-zA-Z0-9_-]{1,30}$/;
// Reject active content even when XML namespace prefixes disguise its tag name;
// consumers must not depend on inline DOM sanitization.
const SVG_DANGEROUS = /<\s*(?:[\w.-]+:)?(?:script|foreignObject|iframe|embed|object|set|discard)\b/i;
const SVG_PREFIXED_ELEMENT = /<\s*\/?\s*[^\s<>/=:]+:/u;
const SVG_EVENT_HANDLER = /\bon\w+\s*=/i;
const SVG_URL_ATTRIBUTE = /\b(?:href|xlink:href|src)\s*=\s*(['"])(.*?)\1/gi;
const SVG_CSS_URL = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
const VARIANT_NAME_RE = /^[a-z0-9-]{1,30}$/;
const RESERVED_VARIANT_NAMES = new Set(['meta', 'index']);
const MAX_VARIANTS_PER_CHARACTER = 10;

export function assetModel(body) {
  const value = body.model ?? body.meta?.model ?? body.skit?.meta?.model ?? body.published?.meta?.model;
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 120) : 'Unknown';
}

// Search descriptions are author-supplied context, never executable instructions.
// Byte limits keep the complete R2 custom metadata safely below its 2 KB limit.
function metadataText(value, maxBytes) {
  if (typeof value !== 'string') return '';
  let result = '';
  for (const character of value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()) {
    if (new TextEncoder().encode(result + character).length > maxBytes) break;
    result += character;
  }
  return result;
}
export function assetSearchMetadata(body = {}, category = '') {
  const meta = body.meta || body.skit?.meta || body.published?.meta || {};
  const rawTags = body.tags ?? meta.tags;
  const tags = [];
  if (Array.isArray(rawTags)) for (const value of rawTags) {
    const tag = metadataText(value, 40);
    if (tag && !tags.includes(tag)) tags.push(tag);
    if (tags.length === 8) break;
  }
  return {category, description: metadataText(body.description ?? meta.description, 600), tags};
}
function commonAssetMetadata(body, category, name) {
  const search = assetSearchMetadata(body, category);
  return {model: assetModel(body), username: body.username, uploadedAt: new Date().toISOString(),
    assetName: metadataText(name, 180), ...search, tags: JSON.stringify(search.tags)};
}
function storedTags(value) {
  try {return assetSearchMetadata({tags: JSON.parse(value || '[]')}).tags;} catch {return [];}
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    'Access-Control-Expose-Headers': 'Retry-After',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function err(message, status = 400) {
  return json({ error: message }, status);
}

function generateSlug(name) {
  const sanitized = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(3)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  return `${sanitized}-${hex}`;
}

export function validateSvg(svg) {
  if (typeof svg !== 'string' || !svg.includes('<svg')) return 'Invalid SVG: must contain <svg tag';
  if (SVG_DANGEROUS.test(svg)) return 'Invalid SVG: dangerous tags not allowed';
  // Preserve the bundled robot's opacity blink, but never permit animation to
  // change links, style, or other security-sensitive attributes.
  for (const match of svg.matchAll(/<\s*(animate\w*)\b([^>]*)>/gi)) {
    const attributes = [...match[2].matchAll(/(?:^|\s)attributeName\s*=\s*(['"])(.*?)\1/g)];
    if (match[1] !== 'animate' || attributes.length !== 1 || attributes[0][2] !== 'opacity') return 'Invalid SVG: only opacity animation is allowed';
  }
  if (SVG_PREFIXED_ELEMENT.test(svg)) return 'Invalid SVG: namespace-prefixed elements not allowed';
  if (/<!\s*(?:DOCTYPE|ENTITY)\b|<\?(?!xml\s)/i.test(svg)) return 'Invalid SVG: document declarations and processing instructions not allowed';
  if (/\bxml:base\s*=/i.test(svg)) return 'Invalid SVG: base URLs not allowed';
  for (const match of svg.matchAll(/\bxmlns(?::([^\s<>/=:]+))?\s*=\s*(['"])(.*?)\2/giu)) {
    const expected = match[1] === 'xlink' ? 'http://www.w3.org/1999/xlink' : !match[1] ? 'http://www.w3.org/2000/svg' : null;
    if (match[3] !== expected) return 'Invalid SVG: unsupported namespace';
  }
  if (SVG_EVENT_HANDLER.test(svg)) return 'Invalid SVG: inline event handlers not allowed';
  if (/@import\b/i.test(svg)) return 'Invalid SVG: CSS imports not allowed';
  for (const match of svg.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>|\bstyle\s*=\s*(['"])(.*?)\2/gi)) {
    if (/\\|&#(?:x0*5c|0*92);/i.test(match[1] ?? match[3])) return 'Invalid SVG: escaped CSS not allowed';
  }

  for (const match of svg.matchAll(SVG_URL_ATTRIBUTE)) {
    if (!isSafeSvgReference(match[2])) return 'Invalid SVG: external references not allowed';
  }
  for (const match of svg.matchAll(SVG_CSS_URL)) {
    if (!isSafeSvgReference(match[2])) return 'Invalid SVG: external CSS references not allowed';
  }
  return null;
}

function isSafeSvgReference(value) {
  const reference = String(value || '').trim();
  return reference.startsWith('#') || /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(reference);
}

// Handles both single and double quoted attributes (DOM serialization uses double quotes)
function extractMetaFromSvg(svg) {
  if (!svg || typeof svg !== 'string') return null;

  // Try single-quoted first (our canonical format, JSON uses " so no conflict)
  let match = svg.match(/data-meta='([^']*)'/);
  if (match) {
    try {
      return JSON.parse(match[1].replace(/&#39;/g, "'"));
    } catch (e) {
      // Fall through to try double-quoted
    }
  }

  // Try double-quoted (DOM serialization converts quotes and escapes " as &quot;)
  match = svg.match(/data-meta="([^"]*)"/);
  if (match) {
    try {
      return JSON.parse(match[1].replace(/&quot;/g, '"'));
    } catch (e) {
      return null;
    }
  }

  return null;
}

function validateUsername(username) {
  if (!username || typeof username !== 'string') return 'username is required';
  if (!USERNAME_RE.test(username)) return 'username must be 1-30 alphanumeric, hyphen, or underscore characters';
  return null;
}

function normalizeCharacterVariants(body) {
  const normalized = {};

  if (body?.variants && typeof body.variants === 'object' && !Array.isArray(body.variants)) {
    for (const [name, svg] of Object.entries(body.variants)) {
      normalized[name] = svg;
    }
  }

  // Backwards compatibility with old upload format.
  if (Object.keys(normalized).length === 0 && body?.front_svg) {
    normalized.front = body.front_svg;
    if (body.back_svg) normalized.back = body.back_svg;
  }

  return normalized;
}

// === Validation per category ===

function validateCharacter(body) {
  const variants = normalizeCharacterVariants(body);
  if (!variants.front) return 'variants.front (or front_svg) is required';

  const variantNames = Object.keys(variants);
  if (variantNames.length > MAX_VARIANTS_PER_CHARACTER) {
    return `Too many variants (max ${MAX_VARIANTS_PER_CHARACTER})`;
  }

  for (const variantName of variantNames) {
    if (!VARIANT_NAME_RE.test(variantName)) {
      return `Invalid variant name: ${variantName}`;
    }
    if (RESERVED_VARIANT_NAMES.has(variantName)) {
      return `Reserved variant name: ${variantName}`;
    }
    const svgErr = validateSvg(variants[variantName]);
    if (svgErr) return `${variantName}: ${svgErr}`;
  }

  // Try to extract meta from embedded data-meta attribute if not provided separately
  let meta = body.meta;
  if (!meta || typeof meta !== 'object') {
    meta = extractMetaFromSvg(variants.front);
  }
  if (!meta || typeof meta !== 'object') return 'meta object is required (either in body.meta or embedded in SVG data-meta attribute)';
  if (!meta.name || typeof meta.name !== 'string') return 'meta.name (string) is required';

  // Normalize body so storage can rely on one shape.
  body.variants = variants;

  return null;
}

function validateProp(body) {
  if (!body.svg) return 'svg is required';
  const svgErr = validateSvg(body.svg);
  if (svgErr) return svgErr;
  // Try to extract meta from embedded data-meta attribute if not provided separately
  let meta = body.meta;
  if (!meta || typeof meta !== 'object') {
    meta = extractMetaFromSvg(body.svg);
  }
  if (!meta || typeof meta !== 'object') return 'meta object is required (either in body.meta or embedded in SVG data-meta attribute)';
  if (!meta.name || typeof meta.name !== 'string') return 'meta.name (string) is required';
  return null;
}

function validateBackground(body) {
  if (!body.landscape_svg && !body.portrait_svg) return 'landscape_svg or portrait_svg is required';
  if (body.landscape_svg) {
    const svgErr = validateSvg(body.landscape_svg);
    if (svgErr) return svgErr;
  }
  if (body.portrait_svg) {
    const pErr = validateSvg(body.portrait_svg);
    if (pErr) return 'portrait_svg: ' + pErr;
  }
  if (!body.name || typeof body.name !== 'string') return 'name is required';
  return null;
}

function validateSkit(body) {
  if (!body.skit || typeof body.skit !== 'object') return 'skit object is required';
  const s = body.skit;
  if (!s.meta?.title) return 'skit.meta.title is required';
  if (!s.stage?.background) return 'skit.stage.background is required';
  if (!s.cast || typeof s.cast !== 'object') return 'skit.cast (object) is required';
  if (!Array.isArray(s.script)) return 'skit.script (array) is required';
  return null;
}

function validatePublished(body) {
  if (!body.published || typeof body.published !== 'object') return 'published object is required';
  const p = body.published;
  if (!p.meta?.title) return 'published.meta.title is required';
  if (!p.assets || typeof p.assets !== 'object') return 'published.assets is required';
  return null;
}

function validateVoice(body) {
  // Support both audio_base64 (WAV) and safetensors_base64 (processed voice)
  const hasAudio = body.audio_base64 && typeof body.audio_base64 === 'string';
  const hasSafetensors = body.safetensors_base64 && typeof body.safetensors_base64 === 'string';

  if (!hasAudio && !hasSafetensors) {
    return 'Either audio_base64 or safetensors_base64 is required';
  }

  if (hasAudio) {
    try {
      const raw = atob(body.audio_base64);
      if (raw.length < 12) return 'Audio data too short';
      if (raw.slice(0, 4) !== 'RIFF' || raw.slice(8, 12) !== 'WAVE') {
        return 'Audio must be WAV format (RIFF/WAVE header required)';
      }
    } catch {
      return 'Invalid base64 in audio_base64';
    }
  }

  if (hasSafetensors) {
    try {
      const raw = atob(body.safetensors_base64);
      if (raw.length < 8) return 'Safetensors data too short';
      // Safetensors files start with an 8-byte header (little-endian u64)
      // We just check it's decodable and has reasonable size
    } catch {
      return 'Invalid base64 in safetensors_base64';
    }
  }

  return null;
}

// === Store files per category ===

async function storeCharacter(bucket, slug, body) {
  const variants = normalizeCharacterVariants(body);
  const variantNames = Object.keys(variants);
  if (!variantNames.includes('front')) {
    throw new Error('Character is missing required front variant');
  }

  // Use provided meta or extract from SVG
  const charMeta = {
    ...(body.meta || extractMetaFromSvg(variants.front) || {}),
    ...assetSearchMetadata(body, 'characters'),
    model: assetModel(body),
    variants: variantNames
  };
  const commonMeta = commonAssetMetadata(body, 'characters', charMeta.name);

  for (const [variantName, svg] of Object.entries(variants)) {
    await bucket.put(`characters/${slug}/${variantName}.svg`, svg, {
      customMetadata: commonMeta,
      httpMetadata: { contentType: 'image/svg+xml' }
    });
  }

  await bucket.put(`characters/${slug}/meta.json`, JSON.stringify(charMeta, null, 2), { customMetadata: commonMeta, httpMetadata: { contentType: 'application/json' } });
  return { slug, files: [...variantNames.map(name => `${name}.svg`), 'meta.json'] };
}

async function storeProp(bucket, slug, body) {
  // Use provided meta or extract from SVG
  const propMeta = {...(body.meta || extractMetaFromSvg(body.svg) || {}), ...assetSearchMetadata(body, 'props'), model: assetModel(body)};
  const commonMeta = commonAssetMetadata(body, 'props', propMeta.name);
  await bucket.put(`props/${slug}/prop.svg`, body.svg, { customMetadata: commonMeta, httpMetadata: { contentType: 'image/svg+xml' } });
  // Store meta.json for backwards compatibility
  await bucket.put(`props/${slug}/meta.json`, JSON.stringify(propMeta, null, 2), { customMetadata: commonMeta, httpMetadata: { contentType: 'application/json' } });
  return { slug, files: ['prop.svg', 'meta.json'] };
}

async function storeBackground(bucket, slug, body) {
  const commonMeta = commonAssetMetadata(body, 'backgrounds', body.name);
  if (body.landscape_svg) await bucket.put(`backgrounds/${slug}/landscape.svg`, body.landscape_svg, { customMetadata: commonMeta, httpMetadata: { contentType: 'image/svg+xml' } });
  if (body.portrait_svg) {
    await bucket.put(`backgrounds/${slug}/portrait.svg`, body.portrait_svg, { customMetadata: commonMeta, httpMetadata: { contentType: 'image/svg+xml' } });
  }
  await bucket.put(`backgrounds/${slug}/meta.json`, JSON.stringify({...body.meta, name: body.name, model: assetModel(body), ...assetSearchMetadata(body, 'backgrounds')}, null, 2), {customMetadata: commonMeta, httpMetadata: {contentType: 'application/json'}});
  return { slug, files: [body.landscape_svg ? 'landscape.svg' : null, body.portrait_svg ? 'portrait.svg' : null, 'meta.json'].filter(Boolean) };
}

async function storeSkit(bucket, slug, body) {
  const commonMeta = commonAssetMetadata(body, 'skits', body.skit.meta.title);
  await bucket.put(`skits/${slug}.json`, JSON.stringify(body.skit, null, 2), { customMetadata: commonMeta, httpMetadata: { contentType: 'application/json' } });
  return { slug, files: [`${slug}.json`] };
}

async function storePublished(bucket, slug, body) {
  const commonMeta = commonAssetMetadata(body, 'published', body.published.meta.title);
  await bucket.put(`published/${slug}.json`, JSON.stringify(body.published), { customMetadata: commonMeta, httpMetadata: { contentType: 'application/json' } });
  return { slug, files: [`${slug}.json`] };
}

async function storeVoice(bucket, slug, body) {
  const commonMeta = commonAssetMetadata(body, 'voices', body.name || slug);

  // Support both WAV audio and processed safetensors
  if (body.safetensors_base64) {
    const safetensorsBytes = Uint8Array.from(atob(body.safetensors_base64), c => c.charCodeAt(0));
    await bucket.put(`voices/${slug}.safetensors`, safetensorsBytes, {
      customMetadata: commonMeta,
      httpMetadata: { contentType: 'application/octet-stream' }
    });
    return { slug, files: [`${slug}.safetensors`] };
  } else {
    const audioBytes = Uint8Array.from(atob(body.audio_base64), c => c.charCodeAt(0));
    await bucket.put(`voices/${slug}.wav`, audioBytes, {
      customMetadata: commonMeta,
      httpMetadata: { contentType: 'audio/wav' }
    });
    return { slug, files: [`${slug}.wav`] };
  }
}

// === Listing helpers ===

function indexSuffix(category) {
  switch (category) {
    case 'characters': return 'meta.json';
    case 'props': return 'meta.json';
    case 'backgrounds': return 'landscape.svg';
    case 'skits': return '.json';
    case 'published': return '.json';
    case 'voices': return null; // Voices can be .wav or .safetensors
  }
}

// Cursor format: JSON { r2Cursor?, skip }
// r2Cursor = opaque R2 cursor for the current page
// skip = number of R2 objects to skip within that page (to resume mid-page)
function encodeCursor(r2Cursor, skip) {
  // Use URL-safe base64 so cursors survive query string round-tripping
  // (standard base64 +/= get mangled by URL decoding)
  return btoa(JSON.stringify({ r: r2Cursor || null, s: skip }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeCursor(cursor) {
  if (!cursor) return { r2Cursor: undefined, skip: 0 };
  try {
    // Restore standard base64 from URL-safe encoding
    let b64 = cursor.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const parsed = JSON.parse(atob(b64));
    return { r2Cursor: parsed.r || undefined, skip: parsed.s || 0 };
  } catch {
    return { r2Cursor: undefined, skip: 0 };
  }
}

async function listCategory(bucket, category, cursor, limit) {
  limit = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
  const suffix = indexSuffix(category);
  const items = [];
  let { r2Cursor, skip } = decodeCursor(cursor);

  while (items.length < limit) {
    const opts = { prefix: `${category}/`, limit: 1000, include: ['customMetadata'] };
    if (r2Cursor) opts.cursor = r2Cursor;

    const listed = await bucket.list(opts);
    const objects = listed.objects;

    for (let i = skip; i < objects.length; i++) {
      const obj = objects[i];
      // For voices, accept both .wav and .safetensors
      if (category === 'backgrounds') {
        if (!obj.key.endsWith('/landscape.svg') && !obj.key.endsWith('/portrait.svg')) continue;
        if (obj.key.endsWith('/portrait.svg')) {
          const landscapeKey = obj.key.replace(/portrait\.svg$/, 'landscape.svg');
          // Prefer landscape as the index when both exist. A storage lookup
          // also deduplicates variants split across R2 or API cursor pages.
          const landscape = typeof bucket.head === 'function' ? await bucket.head(landscapeKey) : await bucket.get(landscapeKey);
          if (landscape) continue;
        }
      } else if (suffix === null) {
        if (!obj.key.endsWith('.wav') && !obj.key.endsWith('.safetensors')) continue;
      } else if (!obj.key.endsWith(suffix)) {
        continue;
      }
      const meta = obj.customMetadata || {};
      items.push({
        key: obj.key,
        slug: extractSlug(category, obj.key),
        name: meta.assetName || obj.key,
        username: meta.username || 'unknown',
        category,
        searchMetadata: Object.hasOwn(meta, 'description') && Object.hasOwn(meta, 'tags'),
        description: metadataText(meta.description, 600),
        tags: storedTags(meta.tags),
        model: assetMetadata[obj.key]?.model || meta.model || 'Unknown',
        uploadedAt: meta.uploadedAt || obj.uploaded?.toISOString(),
        size: obj.size,
      });
      if (items.length >= limit) {
        // Stopped mid-page at R2 object index i. Next request should
        // re-fetch this same R2 page and skip i+1 objects.
        const moreInPage = i + 1 < objects.length;
        const morePages = listed.truncated;
        if (moreInPage || morePages) {
          const nextCursor = moreInPage
            ? encodeCursor(r2Cursor, i + 1)
            : encodeCursor(listed.cursor, 0);
          return { items, cursor: nextCursor, hasMore: true };
        }
        return { items, cursor: null, hasMore: false };
      }
    }

    // Finished scanning this full R2 page without filling limit
    skip = 0;
    if (listed.truncated) {
      r2Cursor = listed.cursor;
    } else {
      break;
    }
  }

  return { items, cursor: null, hasMore: false };
}

function extractSlug(category, key) {
  const prefix = `${category}/`;
  const rest = key.slice(prefix.length);
  if (category === 'skits' || category === 'published' || category === 'voices') {
    return rest.replace(/\.[^.]+$/, '');
  }
  return rest.split('/')[0];
}

// === Request routing ===

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const watch = path.match(/^\/watch\/([a-z0-9-]+)\/?$/);
  if (watch && (request.method === 'GET' || request.method === 'HEAD')) {
    const object = await env.BUCKET.get(`published/${watch[1]}.json`);
    if (!object) return err('Skit not found', 404);
    const skit = JSON.parse(await object.text());
    skit.meta = { ...skit.meta, ...assetMetadata[`published/${watch[1]}.json`] };
    const dataUrl = `https://pelicans-community.sam-cloudflare-d20.workers.dev/api/community/published/${watch[1]}/data.json`;
    const thumbnail = skit.meta?.thumbnail;
    const image = typeof thumbnail === 'string' && thumbnail.startsWith('https://pelicans.art/media/') ? thumbnail : undefined;
    const html = renderSharePage({ title: skit.meta?.title || 'Untitled skit', description: skit.meta?.description || 'A short comedy skit on pelicans.art.', model: object.customMetadata?.model || assetModel(skit), url: `${url.origin}/watch/${watch[1]}`, playerUrl: `https://pelicans.art/skit-player.html?embed=1&captions=1&url=${encodeURIComponent(dataUrl)}`, image, portrait: skit.stage?.orientation === 'portrait' });
    return new Response(request.method === 'HEAD' ? null : html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' } });
  }


  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // Route: POST /api/community/:category
  const postMatch = path.match(/^\/api\/community\/([a-z]+)$/);
  if (postMatch && request.method === 'POST') {
    return handleUpload(request, env, postMatch[1]);
  }

  // Route: GET /api/community/:category
  const listMatch = path.match(/^\/api\/community\/([a-z]+)$/);
  if (listMatch && request.method === 'GET') {
    const category = listMatch[1];
    if (!CATEGORIES.includes(category)) return err('Unknown category: ' + category, 404);
    const cursor = url.searchParams.get('cursor');
    const limit = url.searchParams.get('limit');
    const result = await listCategory(env.BUCKET, category, cursor, limit);
    return json(result);
  }

  // Route: GET /api/community/:category/:id
  const metaMatch = path.match(/^\/api\/community\/([a-z]+)\/([a-z0-9-]+)$/);
  if (metaMatch && request.method === 'GET') {
    return handleGetMeta(env, metaMatch[1], metaMatch[2]);
  }

  // Route: GET /api/community/:category/:id/:file
  const fileMatch = path.match(/^\/api\/community\/([a-z]+)\/([a-z0-9-]+)\/(.+)$/);
  if (fileMatch && request.method === 'GET') {
    return handleGetFile(env, fileMatch[1], fileMatch[2], fileMatch[3]);
  }

  // Route: DELETE /api/community/:category/:id
  const deleteMatch = path.match(/^\/api\/community\/([a-z]+)\/([a-z0-9-]+)$/);
  if (deleteMatch && request.method === 'DELETE') {
    return handleDelete(request, env, deleteMatch[1], deleteMatch[2]);
  }

  return err('Not found', 404);
}

async function handleDelete(request, env, category, slug) {
  if (!CATEGORIES.includes(category)) return err('Unknown category', 404);

  // Require admin key
  const adminKey = env.ADMIN_KEY;
  const provided = request.headers.get('X-Admin-Key');
  if (!adminKey || provided !== adminKey) {
    return err('Unauthorized', 401);
  }

  // List all objects under this slug's prefix and delete them
  let prefix;
  if (category === 'skits' || category === 'published') {
    prefix = `${category}/${slug}.json`;
  } else if (category === 'voices') {
    // Voices can be .wav or .safetensors - list by prefix to find either
    prefix = `${category}/${slug}`;
  } else {
    prefix = `${category}/${slug}/`;
  }

  const objects = [];
  let cursor;
  do {
    const listed = await env.BUCKET.list({ prefix, ...(cursor ? {cursor} : {}) });
    objects.push(...listed.objects);
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  let objectsToDelete = objects;
  if (category === 'skits' || category === 'published') {
    objectsToDelete = objects.filter(o => o.key === `${category}/${slug}.json`);
  }
  // For voices, filter to only exact matches
  if (category === 'voices') {
    objectsToDelete = objects.filter(o =>
      o.key === `voices/${slug}.wav` || o.key === `voices/${slug}.safetensors`
    );
  }
  if (objectsToDelete.length === 0) return err('Not found', 404);

  const keys = objectsToDelete.map(o => o.key);
  await Promise.all(keys.map(k => env.BUCKET.delete(k)));

  return json({ ok: true, deleted: keys });
}

// Cloudflare counters are per location and eventually consistent: abuse
// throttling, not a global billing cap. No identity is claimed by a username.
async function checkUploadLimit(request, env) {
  if (env.UPLOADS_ENABLED === 'false') return err('Uploads are temporarily paused.', 503);
  try {
    if (!env.UPLOAD_LIMITER || !env.UPLOAD_TOTAL_LIMITER) throw new Error('Missing limiter');
    const key = 'pouch:upload:' + (request.headers.get('CF-Connecting-IP') || 'unknown');
    const perClient = await env.UPLOAD_LIMITER.limit({ key });
    const total = perClient.success && await env.UPLOAD_TOTAL_LIMITER.limit({ key: 'pouch:uploads' });
    if (!perClient.success || !total.success) {
      const response = err('Too many uploads. Please wait a minute and try again.', 429);
      response.headers.set('Retry-After', '60');
      return response;
    }
  } catch {
    return err('Uploads are temporarily unavailable. Please try again later.', 503);
  }
  return null;
}

async function readUploadBody(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_PAYLOAD) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PAYLOAD) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

async function handleUpload(request, env, category) {
  if (!CATEGORIES.includes(category)) return err('Unknown category: ' + category, 404);

  const limited = await checkUploadLimit(request, env);
  if (limited) return limited;

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return err('Content-Type must be application/json');
  }

  const rawBody = await readUploadBody(request);
  if (rawBody === null) return err('Payload too large. Max 3MB.', 413);

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return err('Invalid JSON');
  }

  const usernameErr = validateUsername(body.username);
  if (usernameErr) return err(usernameErr);

  let validationErr;
  switch (category) {
    case 'characters': validationErr = validateCharacter(body); break;
    case 'props': validationErr = validateProp(body); break;
    case 'backgrounds': validationErr = validateBackground(body); break;
    case 'skits': validationErr = validateSkit(body); break;
    case 'published': validationErr = validatePublished(body); break;
    case 'voices': validationErr = validateVoice(body); break;
  }
  if (validationErr) return err(validationErr);

  if ((category === 'characters' || category === 'props') && (!body.meta || typeof body.meta !== 'object')) body.meta = extractMetaFromSvg(category === 'characters' ? body.variants.front : body.svg) || {};
  body.model = assetModel(body);
  const search = assetSearchMetadata(body, category);
  body.description = search.description;
  body.tags = search.tags;
  for (const meta of [body.meta, body.skit?.meta, body.published?.meta]) {
    if (meta && typeof meta === 'object') Object.assign(meta, search, {model: body.model});
  }

  const name = body.name || body.meta?.name || body.skit?.meta?.title || body.published?.meta?.title || category;
  const slug = generateSlug(name);

  let result;
  switch (category) {
    case 'characters': result = await storeCharacter(env.BUCKET, slug, body); break;
    case 'props': result = await storeProp(env.BUCKET, slug, body); break;
    case 'backgrounds': result = await storeBackground(env.BUCKET, slug, body); break;
    case 'skits': result = await storeSkit(env.BUCKET, slug, body); break;
    case 'published': result = await storePublished(env.BUCKET, slug, body); break;
    case 'voices': result = await storeVoice(env.BUCKET, slug, body); break;
  }

  return json({ ok: true, category, ...result }, 201);
}

async function handleGetMeta(env, category, slug) {
  if (!CATEGORIES.includes(category)) return err('Unknown category', 404);

  let key;
  let obj;
  switch (category) {
    case 'characters':
    case 'props':
      key = `${category}/${slug}/meta.json`; break;
    case 'backgrounds':
      key = `${category}/${slug}/landscape.svg`; break;
    case 'skits':
    case 'published':
      key = `${category}/${slug}.json`; break;
    case 'voices':
      // Try safetensors first, then wav
      obj = await env.BUCKET.get(`${category}/${slug}.safetensors`);
      if (!obj) {
        obj = await env.BUCKET.get(`${category}/${slug}.wav`);
      }
      break;
  }

  if (category !== 'voices') {
    obj = await env.BUCKET.get(key);
    if (!obj && category === 'backgrounds') {
      key = `${category}/${slug}/portrait.svg`;
      obj = await env.BUCKET.get(key);
    }
  }
  if (!obj) return err('Not found', 404);

  const wrapperMeta = obj.customMetadata || {};
  let bodyMeta = {};

  if (category === 'characters' || category === 'props') {
    try {
      const parsed = JSON.parse(await obj.text());
      if (parsed && typeof parsed === 'object') {
        bodyMeta = parsed;
      }
    } catch {
      bodyMeta = {};
    }
  }

  return json({
    slug,
    ...bodyMeta,
    category,
    name: bodyMeta.name || wrapperMeta.assetName || slug,
    description: metadataText(wrapperMeta.description ?? bodyMeta.description, 600),
    tags: wrapperMeta.tags ? storedTags(wrapperMeta.tags) : assetSearchMetadata(bodyMeta).tags,
    model: assetMetadata[key]?.model || wrapperMeta.model || bodyMeta.model || 'Unknown',
    username: wrapperMeta.username,
    uploadedAt: wrapperMeta.uploadedAt,
    size: obj.size,
    contentType: obj.httpMetadata?.contentType,
  });
}

async function handleGetFile(env, category, slug, filename) {
  if (!CATEGORIES.includes(category)) return err('Unknown category', 404);

  let key;
  let obj;
  if (category === 'skits' || category === 'published') {
    key = `${category}/${slug}.json`;
  } else if (category === 'voices') {
    // Try safetensors first, then wav
    obj = await env.BUCKET.get(`${category}/${slug}.safetensors`);
    if (!obj) {
      obj = await env.BUCKET.get(`${category}/${slug}.wav`);
    }
  } else {
    key = `${category}/${slug}/${filename}`;
  }

  if (category !== 'voices') {
    obj = await env.BUCKET.get(key);
  }
  if (!obj) return err('File not found', 404);

  const headers = {
    ...corsHeaders(),
    'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
    'Cache-Control': 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
  };

  // Applies to old stored objects too: block script execution and external
  // resource loads, and sandbox document capabilities if validation missed content.
  if (/\.svg$/i.test(key || '') || /^image\/svg\+xml(?:;|$)/i.test(headers['Content-Type'])) {
    headers['Content-Type'] = 'image/svg+xml; charset=utf-8';
    headers['Content-Security-Policy'] = "sandbox; default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
  }

  if ((category === 'published' || category === 'skits') && assetMetadata[key]) {
    const value = JSON.parse(await obj.text());
    value.meta = { ...value.meta, ...assetMetadata[key] };
    return new Response(JSON.stringify(value), { headers: { ...headers, 'Cache-Control': 'public, max-age=60' } });
  }
  return new Response(obj.body, { headers });
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env);
    } catch (e) {
      return err('Internal error', 500);
    }
  },
};
