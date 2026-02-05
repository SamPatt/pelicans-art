import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { PARENT_SRC } from '../config.js';

const router = Router();

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function listDirs(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch { return []; }
}

/**
 * Validate that a resolved path stays within the allowed base directory
 */
function assertWithin(base, resolved) {
  const realBase = path.resolve(base);
  const realResolved = path.resolve(resolved);
  if (!realResolved.startsWith(realBase + path.sep) && realResolved !== realBase) {
    const err = new Error('Invalid path');
    err.status = 400;
    throw err;
  }
}

function hasTraversal(name) {
  return name.includes('..') || path.isAbsolute(name);
}

/**
 * GET /api/references/:type
 * type: sprites, backgrounds, props
 */
router.get('/:type', async (req, res) => {
  const { type } = req.params;
  const dir = path.join(PARENT_SRC, type);

  if (!await exists(dir)) {
    return res.json([]);
  }

  try {
    if (type === 'sprites') {
      const names = await listDirs(dir);
      const results = [];
      for (const name of names) {
        const svgPath = path.join(dir, name, 'front.svg');
        if (await exists(svgPath)) {
          const svg = await fs.readFile(svgPath, 'utf-8');
          results.push({ name, svg });
        }
      }
      res.json(results);
    } else if (type === 'backgrounds') {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const results = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const files = await fs.readdir(path.join(dir, entry.name));
          for (const f of files) {
            if (f.endsWith('.svg')) {
              const svg = await fs.readFile(path.join(dir, entry.name, f), 'utf-8');
              results.push({ name: `${entry.name}/${f.replace('.svg', '')}`, svg });
            }
          }
        } else if (entry.name.endsWith('.svg')) {
          const svg = await fs.readFile(path.join(dir, entry.name), 'utf-8');
          results.push({ name: entry.name.replace('.svg', ''), svg });
        }
      }
      res.json(results);
    } else if (type === 'props') {
      const names = await listDirs(dir);
      const results = [];
      for (const name of names) {
        const svgPath = path.join(dir, name, 'prop.svg');
        if (await exists(svgPath)) {
          const svg = await fs.readFile(svgPath, 'utf-8');
          results.push({ name, svg });
        }
      }
      res.json(results);
    } else {
      res.status(400).json({ error: true, message: `Unknown reference type: ${type}` });
    }
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/references/:type/:name
 * Serve a single reference SVG
 */
router.get('/:type/:name(*)', async (req, res) => {
  const { type, name } = req.params;

  if (hasTraversal(name)) {
    return res.status(400).json({ error: true, message: 'Invalid name' });
  }

  let svgPath;

  if (type === 'sprites') {
    svgPath = path.join(PARENT_SRC, 'sprites', name, 'front.svg');
  } else if (type === 'props') {
    svgPath = path.join(PARENT_SRC, 'props', name, 'prop.svg');
  } else if (type === 'backgrounds') {
    if (name.includes('/')) {
      const [bgName, orient] = name.split('/');
      svgPath = path.join(PARENT_SRC, 'backgrounds', bgName, `${orient}.svg`);
    } else {
      svgPath = path.join(PARENT_SRC, 'backgrounds', `${name}.svg`);
    }
  }

  if (!svgPath) {
    return res.status(400).json({ error: true, message: `Unknown reference type: ${type}` });
  }

  try {
    assertWithin(PARENT_SRC, svgPath);
  } catch {
    return res.status(400).json({ error: true, message: 'Invalid path' });
  }

  if (!await exists(svgPath)) {
    return res.status(404).json({ error: true, message: 'Reference not found' });
  }

  const svg = await fs.readFile(svgPath, 'utf-8');
  res.json({ name, svg });
});

export default router;
