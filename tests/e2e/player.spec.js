const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

test('all bundled skits load without player errors', async ({ page }) => {
  const skits = fs.readdirSync(path.join(__dirname, '../../src/published'))
    .filter(name => name.endsWith('.json') && !name.endsWith('-published.json'))
    .map(name => name.replace(/\.json$/, ''));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  for (const skit of skits) {
    await page.goto(`/skit-player.html?embed=1&skit=${encodeURIComponent(skit)}`);
    await expect(page.locator('body')).toHaveAttribute('data-playback-state', 'ready');
    await expect(page.locator('#playBtn')).toBeEnabled();
    await expect(page.locator('#status')).toContainText(/Ready|Loaded/);
  }

  expect(errors).toEqual([]);
});

test('player exposes a deterministic playback-complete state for capture tools', async ({ page }) => {
  const background = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="#123"/></svg>').toString('base64');
  await page.route('**/published/captureSmoke.json', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      meta: { title: 'Capture smoke' },
      stage: { background: 'smoke', orientation: 'landscape' },
      cast: {},
      props: {},
      script: [{ do: 'pause', duration: 0.05 }],
      assets: { sprites: {}, backgrounds: { smoke: `data:image/svg+xml;base64,${background}` }, props: {}, audio: {} }
    })
  }));

  await page.goto('/skit-player.html?embed=1&skit=captureSmoke');
  await expect(page.locator('body')).toHaveAttribute('data-playback-state', 'ready');
  await page.locator('#playBtn').click();
  await expect(page.locator('body')).toHaveAttribute('data-playback-state', 'complete');
});
