import fs from 'fs/promises';
import path from 'path';
import { DATA_DIR } from '../config.js';

const TEMPLATES_DIR = path.join(DATA_DIR, 'templates');

function safePath(baseDir, id) {
  if (!id || typeof id !== 'string' || /[\/\\]/.test(id) || id.includes('..') || path.isAbsolute(id)) {
    const err = new Error(`Invalid ID: ${id}`);
    err.status = 400;
    throw err;
  }
  const resolved = path.join(baseDir, `${id}.json`);
  if (!resolved.startsWith(path.resolve(baseDir) + path.sep)) {
    const err = new Error(`Invalid path for ID: ${id}`);
    err.status = 400;
    throw err;
  }
  return resolved;
}

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

export async function listTemplates() {
  await fs.mkdir(TEMPLATES_DIR, { recursive: true });
  const files = await fs.readdir(TEMPLATES_DIR);
  const templates = [];

  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const data = JSON.parse(await fs.readFile(path.join(TEMPLATES_DIR, f), 'utf-8'));
      templates.push(data);
    } catch { /* skip invalid */ }
  }

  return templates;
}

export async function getTemplate(id) {
  const filePath = safePath(TEMPLATES_DIR, id);
  if (!await exists(filePath)) {
    const err = new Error(`Template not found: ${id}`);
    err.status = 404;
    throw err;
  }
  return JSON.parse(await fs.readFile(filePath, 'utf-8'));
}

export async function saveTemplate(template) {
  const filePath = safePath(TEMPLATES_DIR, template.id);
  await fs.mkdir(TEMPLATES_DIR, { recursive: true });
  const now = new Date().toISOString();
  if (!template.createdAt) template.createdAt = now;
  template.updatedAt = now;

  await fs.writeFile(filePath, JSON.stringify(template, null, 2));
  return template;
}

export async function deleteTemplate(id) {
  const filePath = safePath(TEMPLATES_DIR, id);
  if (!await exists(filePath)) {
    const err = new Error(`Template not found: ${id}`);
    err.status = 404;
    throw err;
  }
  await fs.unlink(filePath);
}
