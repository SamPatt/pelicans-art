#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const options = { sprites: [], backgrounds: [], syncSkit: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--skit') options.skit = argv[++index];
    else if (arg === '--sprite') options.sprites.push(argv[++index]);
    else if (arg === '--background') options.backgrounds.push(argv[++index]);
    else if (arg === '--sync-skit') options.syncSkit = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.skit || (!options.sprites.length && !options.backgrounds.length && !options.syncSkit)) {
    throw new Error('Usage: refresh-published-assets.mjs --skit ID [--sync-skit] [--sprite ID] [--background ID]');
  }
  return options;
}

function dataUrl(content) {
  return `data:image/svg+xml;base64,${Buffer.from(content).toString('base64')}`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const publishedPath = path.join(ROOT, 'src/published', `${options.skit}.json`);
  const published = JSON.parse(await fs.readFile(publishedPath, 'utf8'));
  if (options.syncSkit) {
    const source = JSON.parse(await fs.readFile(path.join(ROOT, 'data/skits', `${options.skit}.json`), 'utf8'));
    for (const key of ['meta', 'stage', 'cast', 'props', 'script']) published[key] = source[key];
    console.log(`Refreshed skit structure: ${options.skit}`);
  }
  published.assets ||= {};
  published.assets.sprites ||= {};
  published.assets.backgrounds ||= {};

  for (const sprite of options.sprites) {
    const svg = await fs.readFile(path.join(ROOT, 'src/sprites', sprite, 'front.svg'), 'utf8');
    published.assets.sprites[`${sprite}-front`] = dataUrl(svg);
    console.log(`Refreshed sprite: ${sprite}`);
  }
  for (const background of options.backgrounds) {
    const orientation = published.stage?.orientation || 'landscape';
    const svg = await fs.readFile(path.join(ROOT, 'src/backgrounds', background, `${orientation}.svg`), 'utf8');
    published.assets.backgrounds[background] = dataUrl(svg);
    console.log(`Refreshed background: ${background}`);
  }

  await fs.writeFile(publishedPath, `${JSON.stringify(published, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
