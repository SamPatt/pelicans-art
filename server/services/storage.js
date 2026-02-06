import fs from 'fs/promises';
import path from 'path';

let DATA_DIR = './data';
let SPRITES_DIR = './src/sprites';
let BACKGROUNDS_DIR = './src/backgrounds';
let PROPS_DIR = './src/props';

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
    // Resolve asset dirs relative to data dir's parent (project root)
    const projectRoot = path.dirname(dataDir);
    SPRITES_DIR = path.join(projectRoot, 'src/sprites');
    BACKGROUNDS_DIR = path.join(projectRoot, 'src/backgrounds');
    PROPS_DIR = path.join(projectRoot, 'src/props');
  }

  // Ensure asset directories exist
  await ensureDir(SPRITES_DIR);
  await ensureDir(BACKGROUNDS_DIR);
  await ensureDir(PROPS_DIR);

  // Ensure data directories for skits, audio, and voices
  await ensureDir(path.join(DATA_DIR, 'skits'));
  await ensureDir(path.join(DATA_DIR, 'published'));
  await ensureDir(path.join(DATA_DIR, 'audio-cache'));
  await ensureDir(path.join(DATA_DIR, 'voices'));

  console.log(`Asset directories: sprites=${SPRITES_DIR}, backgrounds=${BACKGROUNDS_DIR}, props=${PROPS_DIR}`);
  console.log(`Data directory: ${DATA_DIR}`);
}

// --- Sprite Storage ---

export async function listSprites() {
  const spriteNames = await listDirs(SPRITES_DIR);

  const sprites = [];
  for (const name of spriteNames) {
    const metaPath = path.join(SPRITES_DIR, name, 'meta.json');
    let meta = {};
    if (await exists(metaPath)) {
      try {
        meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
      } catch (e) { /* ignore parse errors */ }
    }
    sprites.push({
      name,
      description: meta.description || meta.name || name
    });
  }

  return sprites;
}

export async function getSprite(name) {
  const spritePath = path.join(SPRITES_DIR, name);

  if (!await exists(spritePath)) {
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

  return { name, svg, meta };
}

export async function saveSprite(name, svg, meta) {
  const spritePath = path.join(SPRITES_DIR, name);
  await ensureDir(spritePath);
  await fs.writeFile(path.join(spritePath, 'front.svg'), svg);
  await fs.writeFile(path.join(spritePath, 'meta.json'), JSON.stringify(meta, null, 2));
  return { name };
}

/**
 * Save a specific variant of a sprite
 */
export async function saveSpriteVariant(name, variant, svg) {
  const spritePath = path.join(SPRITES_DIR, name);

  // Check if sprite directory exists
  if (!await exists(spritePath)) {
    throw Object.assign(new Error(`Sprite not found: ${name}`), { status: 404 });
  }

  const variantFile = `${variant}.svg`;
  await fs.writeFile(path.join(spritePath, variantFile), svg);
  return { name, variant };
}

export async function deleteSprite(name) {
  const spritePath = path.join(SPRITES_DIR, name);
  if (!await exists(spritePath)) {
    throw Object.assign(new Error(`Sprite not found: ${name}`), { status: 404 });
  }

  await fs.rm(spritePath, { recursive: true });
}

// --- Background Storage ---
// Backgrounds now use a directory structure with orientation variants:
// backgrounds/office/landscape.svg, backgrounds/office/portrait.svg
// For backward compatibility, we also check for flat files: backgrounds/office.svg

export async function listBackgrounds() {
  let backgrounds = [];
  try {
    const entries = await fs.readdir(BACKGROUNDS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // New directory-based structure
        const bgDir = path.join(BACKGROUNDS_DIR, entry.name);
        const files = await fs.readdir(bgDir);
        const orientations = files
          .filter(f => f.endsWith('.svg'))
          .map(f => f.replace('.svg', ''));

        if (orientations.length > 0) {
          backgrounds.push({
            name: entry.name,
            orientations
          });
        }
      } else if (entry.name.endsWith('.svg')) {
        // Legacy flat file structure - treat as landscape orientation
        backgrounds.push({
          name: entry.name.replace('.svg', ''),
          orientations: ['landscape']
        });
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  return backgrounds;
}

export async function getBackground(name, orientation = 'landscape') {
  // First try new directory structure
  const dirPath = path.join(BACKGROUNDS_DIR, name, `${orientation}.svg`);
  if (await exists(dirPath)) {
    return fs.readFile(dirPath, 'utf-8');
  }

  // Fall back to legacy flat file (only for landscape/default orientation)
  if (orientation === 'landscape') {
    const legacyPath = path.join(BACKGROUNDS_DIR, `${name}.svg`);
    if (await exists(legacyPath)) {
      return fs.readFile(legacyPath, 'utf-8');
    }
  }

  throw Object.assign(new Error(`Background not found: ${name}/${orientation}`), { status: 404 });
}

export async function saveBackground(name, svg, orientation = 'landscape') {
  const bgDir = path.join(BACKGROUNDS_DIR, name);
  await ensureDir(bgDir);
  await fs.writeFile(path.join(bgDir, `${orientation}.svg`), svg);
  return { name, orientation };
}

/**
 * Save a specific orientation variant of a background
 */
export async function saveBackgroundVariant(name, orientation, svg) {
  const bgDir = path.join(BACKGROUNDS_DIR, name);

  // Check if background directory exists (either new style or we need to create it)
  if (!await exists(bgDir)) {
    // Check if legacy flat file exists - if so, migrate it
    const legacyPath = path.join(BACKGROUNDS_DIR, `${name}.svg`);
    if (await exists(legacyPath)) {
      // Migrate legacy file to new structure
      await ensureDir(bgDir);
      const legacySvg = await fs.readFile(legacyPath, 'utf-8');
      await fs.writeFile(path.join(bgDir, 'landscape.svg'), legacySvg);
      await fs.unlink(legacyPath);
    } else {
      throw Object.assign(new Error(`Background not found: ${name}`), { status: 404 });
    }
  }

  await fs.writeFile(path.join(bgDir, `${orientation}.svg`), svg);
  return { name, orientation };
}

export async function deleteBackground(name) {
  const bgDir = path.join(BACKGROUNDS_DIR, name);

  // Check for new directory structure
  if (await exists(bgDir)) {
    const stat = await fs.stat(bgDir);
    if (stat.isDirectory()) {
      await fs.rm(bgDir, { recursive: true });
      return;
    }
  }

  // Check for legacy flat file
  const legacyPath = path.join(BACKGROUNDS_DIR, `${name}.svg`);
  if (await exists(legacyPath)) {
    await fs.unlink(legacyPath);
    return;
  }

  throw Object.assign(new Error(`Background not found: ${name}`), { status: 404 });
}

// --- Prop Storage ---
// Props use a directory structure: props/coffee-mug/prop.svg, props/coffee-mug/meta.json

export async function listProps() {
  const propNames = await listDirs(PROPS_DIR);

  const props = [];
  for (const name of propNames) {
    const metaPath = path.join(PROPS_DIR, name, 'meta.json');
    let meta = {};
    if (await exists(metaPath)) {
      try {
        meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
      } catch (e) { /* ignore parse errors */ }
    }
    props.push({
      name,
      description: meta.description || meta.name || name,
      defaultScale: meta.defaultScale || 1.0,
      anchorPoint: meta.anchorPoint || [0.5, 1.0],
      holdOffset: meta.holdOffset || [0, -10]
    });
  }

  return props;
}

export async function getProp(name) {
  const propPath = path.join(PROPS_DIR, name);

  if (!await exists(propPath)) {
    throw Object.assign(new Error(`Prop not found: ${name}`), { status: 404 });
  }

  const svgPath = path.join(propPath, 'prop.svg');
  if (!await exists(svgPath)) {
    throw Object.assign(new Error(`Prop missing prop.svg: ${name}`), { status: 404 });
  }

  const svg = await fs.readFile(svgPath, 'utf-8');

  const metaPath = path.join(propPath, 'meta.json');
  let meta = {};
  if (await exists(metaPath)) {
    try {
      meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
    } catch (e) { /* ignore parse errors */ }
  }

  return { name, svg, meta };
}

export async function saveProp(name, svg, meta) {
  const propPath = path.join(PROPS_DIR, name);
  await ensureDir(propPath);
  await fs.writeFile(path.join(propPath, 'prop.svg'), svg);
  await fs.writeFile(path.join(propPath, 'meta.json'), JSON.stringify(meta, null, 2));
  return { name };
}

export async function deleteProp(name) {
  const propPath = path.join(PROPS_DIR, name);
  if (!await exists(propPath)) {
    throw Object.assign(new Error(`Prop not found: ${name}`), { status: 404 });
  }

  await fs.rm(propPath, { recursive: true });
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

// --- Voice Storage ---

/**
 * Get the path to the voices index file
 */
function getVoicesIndexPath() {
  return path.join(DATA_DIR, 'voices', 'voices.json');
}

/**
 * Load the voices index, creating it if it doesn't exist
 */
async function loadVoicesIndex() {
  const indexPath = getVoicesIndexPath();
  if (!await exists(indexPath)) {
    return {};
  }
  try {
    const content = await fs.readFile(indexPath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.warn('Failed to parse voices.json, returning empty:', e.message);
    return {};
  }
}

/**
 * Save the voices index
 */
async function saveVoicesIndex(index) {
  const indexPath = getVoicesIndexPath();
  await ensureDir(path.dirname(indexPath));
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
}

/**
 * List all custom voices
 */
export async function listVoices() {
  const index = await loadVoicesIndex();
  return Object.entries(index).map(([name, data]) => ({
    name,
    displayName: data.displayName || name,
    createdAt: data.createdAt,
    sourceFile: data.sourceFile
  }));
}

/**
 * Get a specific voice's metadata
 */
export async function getVoice(name) {
  const index = await loadVoicesIndex();
  if (!index[name]) {
    throw Object.assign(new Error(`Voice not found: ${name}`), { status: 404 });
  }
  return { name, ...index[name] };
}

/**
 * Get path to a voice's safetensors file
 */
export function getVoicePath(name) {
  return path.join(DATA_DIR, 'voices', `${name}.safetensors`);
}

/**
 * Check if a voice's safetensors file exists
 */
export async function voiceFileExists(name) {
  return exists(getVoicePath(name));
}

/**
 * Save voice metadata to the index
 */
export async function saveVoice(name, metadata) {
  const index = await loadVoicesIndex();
  index[name] = {
    displayName: metadata.displayName || name,
    createdAt: metadata.createdAt || new Date().toISOString(),
    sourceFile: metadata.sourceFile || null
  };
  await saveVoicesIndex(index);
  return { name, ...index[name] };
}

/**
 * Delete a voice (metadata and safetensors file)
 */
export async function deleteVoice(name) {
  const index = await loadVoicesIndex();
  if (!index[name]) {
    throw Object.assign(new Error(`Voice not found: ${name}`), { status: 404 });
  }

  // Delete the safetensors file if it exists
  const safetensorsPath = getVoicePath(name);
  if (await exists(safetensorsPath)) {
    await fs.unlink(safetensorsPath);
  }

  // Remove from index
  delete index[name];
  await saveVoicesIndex(index);
}

/**
 * Get the voices directory path
 */
export function getVoicesDir() {
  return path.join(DATA_DIR, 'voices');
}
