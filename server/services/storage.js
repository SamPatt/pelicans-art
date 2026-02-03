import fs from 'fs/promises';
import path from 'path';

let DATA_DIR = './data';
let BUILTIN_SPRITES_DIR = './src/sprites';
let BUILTIN_BACKGROUNDS_DIR = './src/backgrounds';

// --- Helper Functions ---

export async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listDirs(dirPath) {
  // List only directories, not files (filters out index.json, meta-schema.json, etc.)
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

// --- Initialization ---

export async function ensureDataDirs(dataDir) {
  if (dataDir) {
    DATA_DIR = dataDir;
    // Resolve builtin dirs relative to data dir's parent (project root)
    const projectRoot = path.dirname(dataDir);
    BUILTIN_SPRITES_DIR = path.join(projectRoot, 'src/sprites');
    BUILTIN_BACKGROUNDS_DIR = path.join(projectRoot, 'src/backgrounds');
  }

  await ensureDir(path.join(DATA_DIR, 'sprites'));
  await ensureDir(path.join(DATA_DIR, 'backgrounds'));
  await ensureDir(path.join(DATA_DIR, 'skits'));
  await ensureDir(path.join(DATA_DIR, 'published'));
  await ensureDir(path.join(DATA_DIR, 'audio-cache'));

  console.log(`Data directories initialized at: ${DATA_DIR}`);
}

// --- Sprite Storage ---

export async function listSprites() {
  const builtin = await listDirs(BUILTIN_SPRITES_DIR);
  const user = await listDirs(path.join(DATA_DIR, 'sprites'));

  // User sprites listed first (they take precedence), then built-ins not shadowed
  const userSet = new Set(user);

  const sprites = [];

  // Add user sprites
  for (const name of user) {
    const metaPath = path.join(DATA_DIR, 'sprites', name, 'meta.json');
    let meta = {};
    if (await exists(metaPath)) {
      try {
        meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
      } catch (e) { /* ignore parse errors */ }
    }
    sprites.push({
      name,
      builtin: false,
      description: meta.description || meta.name || name
    });
  }

  // Add built-in sprites not shadowed by user sprites
  for (const name of builtin) {
    if (userSet.has(name)) continue;

    const metaPath = path.join(BUILTIN_SPRITES_DIR, name, 'meta.json');
    let meta = {};
    if (await exists(metaPath)) {
      try {
        meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
      } catch (e) { /* ignore parse errors */ }
    }
    sprites.push({
      name,
      builtin: true,
      description: meta.description || meta.name || name
    });
  }

  return sprites;
}

export async function getSprite(name) {
  // Check user sprites first, then builtin
  const userPath = path.join(DATA_DIR, 'sprites', name);
  const builtinPath = path.join(BUILTIN_SPRITES_DIR, name);

  let spritePath;
  let isBuiltin = false;

  if (await exists(userPath)) {
    spritePath = userPath;
  } else if (await exists(builtinPath)) {
    spritePath = builtinPath;
    isBuiltin = true;
  } else {
    throw Object.assign(new Error(`Sprite not found: ${name}`), { status: 404 });
  }

  const svgPath = path.join(spritePath, 'front.svg');
  if (!await exists(svgPath)) {
    throw Object.assign(new Error(`Sprite missing front.svg: ${name}`), { status: 404 });
  }

  const svg = await fs.readFile(svgPath, 'utf-8');

  const metaPath = path.join(spritePath, 'meta.json');
  let meta = {};
  if (await exists(metaPath)) {
    try {
      meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
    } catch (e) { /* ignore parse errors */ }
  }

  return { name, svg, meta, builtin: isBuiltin };
}

export async function saveSprite(name, svg, meta) {
  const spritePath = path.join(DATA_DIR, 'sprites', name);
  await ensureDir(spritePath);
  await fs.writeFile(path.join(spritePath, 'front.svg'), svg);
  await fs.writeFile(path.join(spritePath, 'meta.json'), JSON.stringify(meta, null, 2));
  return { name, builtin: false };
}

/**
 * Save directly to built-in sprites directory (src/sprites)
 * Used by sprite editor for development workflow
 */
export async function saveBuiltinSprite(name, variant, svg) {
  const spritePath = path.join(BUILTIN_SPRITES_DIR, name);

  // Check if sprite directory exists
  if (!await exists(spritePath)) {
    throw Object.assign(new Error(`Sprite not found: ${name}`), { status: 404 });
  }

  const variantFile = `${variant}.svg`;
  await fs.writeFile(path.join(spritePath, variantFile), svg);
  return { name, variant, builtin: true };
}

export async function deleteSprite(name) {
  // Prevent deleting built-in sprites
  const builtinPath = path.join(BUILTIN_SPRITES_DIR, name);
  if (await exists(builtinPath)) {
    const userPath = path.join(DATA_DIR, 'sprites', name);
    if (!await exists(userPath)) {
      throw Object.assign(new Error(`Cannot delete built-in sprite: ${name}`), { status: 403 });
    }
    // User has a shadow sprite - delete the shadow
  }

  const spritePath = path.join(DATA_DIR, 'sprites', name);
  if (!await exists(spritePath)) {
    throw Object.assign(new Error(`Sprite not found: ${name}`), { status: 404 });
  }

  await fs.rm(spritePath, { recursive: true });
}

// --- Background Storage ---

export async function listBackgrounds() {
  // Get built-in backgrounds
  let builtin = [];
  try {
    const files = await fs.readdir(BUILTIN_BACKGROUNDS_DIR);
    builtin = files
      .filter(f => f.endsWith('.svg'))
      .map(f => f.replace('.svg', ''));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  // Get user backgrounds
  let user = [];
  const userBgDir = path.join(DATA_DIR, 'backgrounds');
  try {
    const files = await fs.readdir(userBgDir);
    user = files
      .filter(f => f.endsWith('.svg'))
      .map(f => f.replace('.svg', ''));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  // User backgrounds first (they can shadow built-ins), then non-shadowed built-ins
  const userSet = new Set(user);
  const backgrounds = [];

  // Add user backgrounds
  for (const name of user) {
    backgrounds.push({ name, builtin: false });
  }

  // Add built-in backgrounds not shadowed by user
  for (const name of builtin) {
    if (!userSet.has(name)) {
      backgrounds.push({ name, builtin: true });
    }
  }

  return backgrounds;
}

export async function getBackground(name) {
  // Check user backgrounds first, then builtin
  const userPath = path.join(DATA_DIR, 'backgrounds', `${name}.svg`);
  const builtinPath = path.join(BUILTIN_BACKGROUNDS_DIR, `${name}.svg`);

  if (await exists(userPath)) {
    return fs.readFile(userPath, 'utf-8');
  }

  if (await exists(builtinPath)) {
    return fs.readFile(builtinPath, 'utf-8');
  }

  throw Object.assign(new Error(`Background not found: ${name}`), { status: 404 });
}

export async function saveBackground(name, svg) {
  const bgDir = path.join(DATA_DIR, 'backgrounds');
  await ensureDir(bgDir);
  await fs.writeFile(path.join(bgDir, `${name}.svg`), svg);
  return { name, builtin: false };
}

export async function deleteBackground(name) {
  // Prevent deleting built-in backgrounds
  const builtinPath = path.join(BUILTIN_BACKGROUNDS_DIR, `${name}.svg`);
  if (await exists(builtinPath)) {
    const userPath = path.join(DATA_DIR, 'backgrounds', `${name}.svg`);
    if (!await exists(userPath)) {
      throw Object.assign(new Error(`Cannot delete built-in background: ${name}`), { status: 403 });
    }
    // User has a shadow - delete the shadow
  }

  const bgPath = path.join(DATA_DIR, 'backgrounds', `${name}.svg`);
  if (!await exists(bgPath)) {
    throw Object.assign(new Error(`Background not found: ${name}`), { status: 404 });
  }

  await fs.unlink(bgPath);
}

// --- Skit Storage ---

export async function listSkits() {
  const skitsDir = path.join(DATA_DIR, 'skits');
  let files;
  try {
    files = await fs.readdir(skitsDir);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  const skits = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;

    const filePath = path.join(skitsDir, f);
    try {
      const content = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      const stat = await fs.stat(filePath);
      skits.push({
        id: f.replace('.json', ''),
        title: content.meta?.title || 'Untitled',
        description: content.meta?.description,
        updatedAt: stat.mtime
      });
    } catch (e) {
      // Skip invalid JSON files
      console.warn(`Skipping invalid skit file: ${f}`);
    }
  }

  return skits;
}

export async function getSkit(id) {
  const filePath = path.join(DATA_DIR, 'skits', `${id}.json`);
  if (!await exists(filePath)) {
    throw Object.assign(new Error(`Skit not found: ${id}`), { status: 404 });
  }

  const content = await fs.readFile(filePath, 'utf-8');
  return { id, ...JSON.parse(content) };
}

export async function saveSkit(id, skit) {
  await ensureDir(path.join(DATA_DIR, 'skits'));

  // Don't include id in the stored JSON
  const { id: _, ...skitData } = skit;

  await fs.writeFile(
    path.join(DATA_DIR, 'skits', `${id}.json`),
    JSON.stringify(skitData, null, 2)
  );

  return { id, ...skitData };
}

export async function deleteSkit(id) {
  const filePath = path.join(DATA_DIR, 'skits', `${id}.json`);
  if (!await exists(filePath)) {
    throw Object.assign(new Error(`Skit not found: ${id}`), { status: 404 });
  }
  await fs.unlink(filePath);
}

// --- Published Skit Storage ---

export async function listPublished() {
  const pubDir = path.join(DATA_DIR, 'published');
  let files;
  try {
    files = await fs.readdir(pubDir);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  const published = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;

    const filePath = path.join(pubDir, f);
    try {
      const content = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      const stat = await fs.stat(filePath);
      published.push({
        id: f.replace('.json', ''),
        title: content.meta?.title || 'Untitled',
        publishedAt: content.publishedAt || stat.mtime,
        size: stat.size
      });
    } catch (e) {
      console.warn(`Skipping invalid published file: ${f}`);
    }
  }

  return published;
}

export async function getPublished(id) {
  const filePath = path.join(DATA_DIR, 'published', `${id}.json`);
  if (!await exists(filePath)) {
    throw Object.assign(new Error(`Published skit not found: ${id}`), { status: 404 });
  }

  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

export async function savePublished(id, data) {
  await ensureDir(path.join(DATA_DIR, 'published'));
  const filePath = path.join(DATA_DIR, 'published', `${id}.json`);
  await fs.writeFile(filePath, JSON.stringify(data));
  const stat = await fs.stat(filePath);
  return { id, size: stat.size };
}

export async function deletePublished(id) {
  const filePath = path.join(DATA_DIR, 'published', `${id}.json`);
  if (!await exists(filePath)) {
    throw Object.assign(new Error(`Published skit not found: ${id}`), { status: 404 });
  }
  await fs.unlink(filePath);
}
