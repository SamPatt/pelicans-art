#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assetMetadata } from '../worker/asset-metadata.js';
import { renderSharePage } from '../worker/share-page.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = 'https://pelicans-community.sam-cloudflare-d20.workers.dev/api/community';
const site = 'https://pelicans.art';
const catalog = { bundled: {}, pouch: {} };
const entries = [];
// Only release assets, not experimental untracked bundles in a developer's checkout.
const tracked = execFileSync('git', ['ls-files', 'src/published/*.json'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
for (const file of tracked) {
  const skit = JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));
  const id = path.basename(file, '.json');
  entries.push({ id, kind: 'bundled', skit, dataUrl: `${site}/published/${id}.json` });
}
let cursor;
do {
  const response = await fetch(`${api}/published?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
  if (!response.ok) throw new Error(`Pouch listing: ${response.status}`);
  const list = await response.json();
  for (const item of list.items) {
    const dataUrl = `${api}/published/${item.slug}/data.json`;
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error(`Pouch skit ${item.slug}: ${response.status}`);
    entries.push({ id: item.slug, kind: 'pouch', skit: await response.json(), dataUrl, model: item.model });
  }
  cursor = list.hasMore ? list.cursor : null;
} while (cursor);
for (const {id, kind, skit, dataUrl, model} of entries) {
  const slug = kind === 'bundled' ? id.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() : id;
  const route = `watch/${slug}/`;
  const url = `${site}/${route}`;
  catalog[kind][id] = url;
  const matchingPouch = entries.find(entry => entry.kind === 'pouch' && entry.skit.meta?.title === skit.meta?.title);
  const captured = `media/bundled-${id}.png`;
  const hasCapture = await fs.access(path.join(root,'src',captured)).then(()=>true).catch(()=>false);
  const image = (hasCapture ? `${site}/${captured}` : undefined) || skit.meta?.thumbnail || assetMetadata[`published/${id}.json`]?.thumbnail || assetMetadata[`published/${matchingPouch?.id}.json`]?.thumbnail || (id === 'pelicanBenchmark' ? `${site}/media/pelican-benchmark-cover.png` : undefined) || (skit.meta?.title === 'The Description' ? `${site}/media/the-description-cover.png` : skit.meta?.title === 'The Box' ? `${site}/media/the-box-cover.png` : undefined);
  const html = renderSharePage({ title: skit.meta?.title || id, description: skit.meta?.description || 'A short comedy skit on pelicans.art.', model: skit.meta?.model || model || 'Unknown', url, playerUrl: `${site}/skit-player.html?embed=1&captions=1&url=${encodeURIComponent(dataUrl)}`, image: typeof image === 'string' && image.startsWith(`${site}/media/`) ? image : undefined, portrait: skit.stage?.orientation === 'portrait' });
  await fs.mkdir(path.join(root, 'src', route), { recursive: true });
  await fs.writeFile(path.join(root, 'src', route, 'index.html'), html);
}
await fs.writeFile(path.join(root, 'src/js/share-catalog.js'), `window.PELICAN_SHARE_CATALOG = ${JSON.stringify(catalog, null, 2)};\n`);
console.log(`Built ${entries.length} share pages.`);
