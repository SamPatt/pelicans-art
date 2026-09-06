const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const tracker = 'https://ruddy-mule.pikapod.net/script.js';

test('local player makes no analytics requests even when tracking is unavailable', async ({page}) => {
  const requests=[];
  await page.route('https://ruddy-mule.pikapod.net/**',route=>{requests.push(route.request().url());return route.abort();});
  await page.goto('/skit-player.html?embed=1&skit=theBox');
  await expect(page.locator('#playBtn')).toBeEnabled();
  expect(requests).toEqual([]);
  await expect(page.locator(`script[src="${tracker}"]`)).toHaveCount(0);
});

test('public page tracks once while its embedded player does not', async ({page}) => {
  let requests=0;
  const loader=fs.readFileSync('src/js/site-analytics.js','utf8');
  await page.route(tracker, route=>{requests++;return route.fulfill({contentType:'text/javascript',body:''});});
  await page.route('https://pelicans.art/**',route=>route.fulfill({contentType:'text/html',body:`<html><head><script>${loader}</script></head><body>${new URL(route.request().url()).pathname==='/'?'<iframe src="https://pelicans.art/skit-player.html"></iframe>':''}</body></html>`}));
  await page.goto('https://pelicans.art/');
  expect(requests).toBe(1);
  await expect(page.locator(`head script[src="${tracker}"]`)).toHaveAttribute('data-website-id','9bc694aa-3b94-457a-9e3a-adabd7a04b7f');
  await expect(page.frameLocator('iframe').locator(`script[src="${tracker}"]`)).toHaveCount(0);
});
