// Pelicans.art Community Worker — Cloudflare Worker with R2 storage

const CATEGORIES = ['characters', 'props', 'backgrounds', 'skits', 'published', 'voices'];
const MAX_PAYLOAD = 3 * 1024 * 1024; // 3MB
const USERNAME_RE = /^[a-zA-Z0-9_-]{1,30}$/;
const SVG_DANGEROUS = /<\s*(script|foreignObject|iframe|embed|object)\b/i;
const SVG_EVENT_HANDLER = /\bon\w+\s*=/i;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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

function validateSvg(svg) {
  if (typeof svg !== 'string' || !svg.includes('<svg')) return 'Invalid SVG: must contain <svg tag';
  if (SVG_DANGEROUS.test(svg)) return 'Invalid SVG: dangerous tags not allowed';
  if (SVG_EVENT_HANDLER.test(svg)) return 'Invalid SVG: inline event handlers not allowed';
  return null;
}

function validateUsername(username) {
  if (!username || typeof username !== 'string') return 'username is required';
  if (!USERNAME_RE.test(username)) return 'username must be 1-30 alphanumeric, hyphen, or underscore characters';
  return null;
}

// === Validation per category ===

function validateCharacter(body) {
  if (!body.front_svg) return 'front_svg is required';
  const svgErr = validateSvg(body.front_svg);
  if (svgErr) return svgErr;
  if (body.back_svg) {
    const backErr = validateSvg(body.back_svg);
    if (backErr) return 'back_svg: ' + backErr;
  }
  if (!body.meta || typeof body.meta !== 'object') return 'meta object is required';
  if (!body.meta.name || typeof body.meta.name !== 'string') return 'meta.name (string) is required';
  if (!body.meta.type || typeof body.meta.type !== 'string') return 'meta.type (string) is required';
  return null;
}

function validateProp(body) {
  if (!body.svg) return 'svg is required';
  const svgErr = validateSvg(body.svg);
  if (svgErr) return svgErr;
  if (!body.meta || typeof body.meta !== 'object') return 'meta object is required';
  if (!body.meta.name || typeof body.meta.name !== 'string') return 'meta.name (string) is required';
  return null;
}

function validateBackground(body) {
  if (!body.landscape_svg) return 'landscape_svg is required';
  const svgErr = validateSvg(body.landscape_svg);
  if (svgErr) return svgErr;
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
  if (!body.audio_base64 || typeof body.audio_base64 !== 'string') return 'audio_base64 is required';
  try {
    // Validate the entire base64 string is decodable, not just the header
    const raw = atob(body.audio_base64);
    if (raw.length < 12) return 'Audio data too short';
    if (raw.slice(0, 4) !== 'RIFF' || raw.slice(8, 12) !== 'WAVE') {
      return 'Audio must be WAV format (RIFF/WAVE header required)';
    }
  } catch {
    return 'Invalid base64 in audio_base64';
  }
  return null;
}

// === Store files per category ===

async function storeCharacter(bucket, slug, body, meta) {
  const commonMeta = { username: body.username, uploadedAt: new Date().toISOString(), assetName: body.meta.name, category: 'characters' };
  await bucket.put(`characters/${slug}/front.svg`, body.front_svg, { customMetadata: commonMeta, httpMetadata: { contentType: 'image/svg+xml' } });
  if (body.back_svg) {
    await bucket.put(`characters/${slug}/back.svg`, body.back_svg, { customMetadata: commonMeta, httpMetadata: { contentType: 'image/svg+xml' } });
  }
  await bucket.put(`characters/${slug}/meta.json`, JSON.stringify(body.meta, null, 2), { customMetadata: commonMeta, httpMetadata: { contentType: 'application/json' } });
  return { slug, files: ['front.svg', body.back_svg ? 'back.svg' : null, 'meta.json'].filter(Boolean) };
}

async function storeProp(bucket, slug, body) {
  const commonMeta = { username: body.username, uploadedAt: new Date().toISOString(), assetName: body.meta.name, category: 'props' };
  await bucket.put(`props/${slug}/prop.svg`, body.svg, { customMetadata: commonMeta, httpMetadata: { contentType: 'image/svg+xml' } });
  await bucket.put(`props/${slug}/meta.json`, JSON.stringify(body.meta, null, 2), { customMetadata: commonMeta, httpMetadata: { contentType: 'application/json' } });
  return { slug, files: ['prop.svg', 'meta.json'] };
}

async function storeBackground(bucket, slug, body) {
  const commonMeta = { username: body.username, uploadedAt: new Date().toISOString(), assetName: body.name, category: 'backgrounds' };
  await bucket.put(`backgrounds/${slug}/landscape.svg`, body.landscape_svg, { customMetadata: commonMeta, httpMetadata: { contentType: 'image/svg+xml' } });
  if (body.portrait_svg) {
    await bucket.put(`backgrounds/${slug}/portrait.svg`, body.portrait_svg, { customMetadata: commonMeta, httpMetadata: { contentType: 'image/svg+xml' } });
  }
  return { slug, files: ['landscape.svg', body.portrait_svg ? 'portrait.svg' : null].filter(Boolean) };
}

async function storeSkit(bucket, slug, body) {
  const commonMeta = { username: body.username, uploadedAt: new Date().toISOString(), assetName: body.skit.meta.title, category: 'skits' };
  await bucket.put(`skits/${slug}.json`, JSON.stringify(body.skit, null, 2), { customMetadata: commonMeta, httpMetadata: { contentType: 'application/json' } });
  return { slug, files: [`${slug}.json`] };
}

async function storePublished(bucket, slug, body) {
  const commonMeta = { username: body.username, uploadedAt: new Date().toISOString(), assetName: body.published.meta.title, category: 'published' };
  await bucket.put(`published/${slug}.json`, JSON.stringify(body.published), { customMetadata: commonMeta, httpMetadata: { contentType: 'application/json' } });
  return { slug, files: [`${slug}.json`] };
}

async function storeVoice(bucket, slug, body) {
  const commonMeta = { username: body.username, uploadedAt: new Date().toISOString(), assetName: body.name || slug, category: 'voices' };
  const audioBytes = Uint8Array.from(atob(body.audio_base64), c => c.charCodeAt(0));
  await bucket.put(`voices/${slug}.wav`, audioBytes, { customMetadata: commonMeta, httpMetadata: { contentType: 'audio/wav' } });
  return { slug, files: [`${slug}.wav`] };
}

// === Listing helpers ===

function indexSuffix(category) {
  switch (category) {
    case 'characters': return 'meta.json';
    case 'props': return 'meta.json';
    case 'backgrounds': return 'landscape.svg';
    case 'skits': return '.json';
    case 'published': return '.json';
    case 'voices': return '.wav';
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
      if (!obj.key.endsWith(suffix)) continue;
      const meta = obj.customMetadata || {};
      items.push({
        key: obj.key,
        slug: extractSlug(category, obj.key),
        name: meta.assetName || obj.key,
        username: meta.username || 'unknown',
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

  return err('Not found', 404);
}

async function handleUpload(request, env, category) {
  if (!CATEGORIES.includes(category)) return err('Unknown category: ' + category, 404);

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return err('Content-Type must be application/json');
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_PAYLOAD) {
    return err(`Payload too large (${(rawBody.length / 1024 / 1024).toFixed(1)}MB). Max 3MB.`);
  }

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
      key = `${category}/${slug}.wav`; break;
  }

  const obj = await env.BUCKET.get(key);
  if (!obj) return err('Not found', 404);

  const meta = obj.customMetadata || {};
  return json({
    slug,
    category,
    name: meta.assetName,
    username: meta.username,
    uploadedAt: meta.uploadedAt,
    size: obj.size,
    contentType: obj.httpMetadata?.contentType,
  });
}

async function handleGetFile(env, category, slug, filename) {
  if (!CATEGORIES.includes(category)) return err('Unknown category', 404);

  let key;
  if (category === 'skits' || category === 'published') {
    key = `${category}/${slug}.json`;
  } else if (category === 'voices') {
    key = `${category}/${slug}.wav`;
  } else {
    key = `${category}/${slug}/${filename}`;
  }

  const obj = await env.BUCKET.get(key);
  if (!obj) return err('File not found', 404);

  const headers = {
    ...corsHeaders(),
    'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
    'Cache-Control': 'public, max-age=86400',
  };

  return new Response(obj.body, { headers });
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env);
    } catch (e) {
      return json({ error: 'Internal error', detail: e.message }, 500);
    }
  },
};
