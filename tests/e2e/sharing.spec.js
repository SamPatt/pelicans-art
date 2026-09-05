const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

test('share pages expose metadata without JavaScript and load the player', async ({ page, request }) => {
  const response = await request.get('/watch/the-description/');
  const html = await response.text();
  expect(html).toContain('property="og:title" content="The Description"');
  expect(html).toContain('property="og:image" content="https://pelicans.art/media/the-description-cover.png"');
  expect(html).toContain('Model: GPT-6 Astra');
  // Keep the wrapper and its iframe on the tested release, while preserving real Pouch data URLs.
  await page.route('https://pelicans.art/**', async route => {
    const target = new URL(route.request().url());
    const local = await request.get(target.pathname + target.search);
    await route.fulfill({response: local});
  });
  await page.goto('/watch/the-description/');
  await expect(page.getByRole('heading', {name:'The Description'})).toBeVisible();
  await expect(page.frameLocator('iframe').locator('body')).toHaveAttribute('data-playback-state', 'ready');
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await page.evaluate(() => Object.defineProperty(navigator, 'share', {value:undefined,configurable:true}));
  await page.getByRole('button',{name:'Share skit'}).click();
  await expect(page.getByRole('status')).toHaveText('Link copied!');
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('https://pelicans.art/watch/the-description/');
});

test('Pouch shows model defaults and links to skit-specific share pages', async ({page}) => {
  await page.goto('/community.html?type=published&id=the-description-f8ccb1');
  await expect(page.locator('.detail-info')).toContainText('GPT-6 Astra');
  const popupPromise = page.waitForEvent('popup');
  await page.locator('.detail-header-play').click();
  const popup = await popupPromise;
  expect(popup.url()).toContain('/watch/the-description-f8ccb1/');
  await popup.close();
  await page.goto('/community.html?type=published&id=the-box-841b1e');
  await expect(page.locator('.detail-info')).toContainText('Unknown');
});

test('all release bundles and Pouch skits load and begin playback', async ({page}) => {
  test.setTimeout(180_000);
  const errors=[];page.on('pageerror', e=>errors.push(e.message));
  const catalogScript=fs.readFileSync(path.join(__dirname,'../../src/js/share-catalog.js'),'utf8');
  const catalog=JSON.parse(catalogScript.slice(catalogScript.indexOf('=')+1).trim().replace(/;$/,''));
  const sources=[...Object.keys(catalog.bundled).map(id=>`/skit-player.html?embed=1&skit=${id}`), ...Object.keys(catalog.pouch).map(id=>`/skit-player.html?embed=1&url=${encodeURIComponent(`https://pelicans-community.sam-cloudflare-d20.workers.dev/api/community/published/${id}/data.json`)}`)];
  for(const source of sources){
    await page.goto(source);
    await expect(page.locator('body'),source).toHaveAttribute('data-playback-state','ready');
    await page.getByRole('button',{name:'Play skit',exact:true}).click();
    await expect(page.locator('body'),source).toHaveAttribute('data-playback-state','playing');
    await expect(page.locator('#caption'),source).not.toHaveText('',{timeout:12_000});
  }
  expect(errors).toEqual([]);
});
