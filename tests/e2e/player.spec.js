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

test('published skits can hard-cut between bundled backgrounds', async ({ page }) => {
  const svgDataUrl = (color) => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="${color}"/></svg>`).toString('base64')}`;
  const secondBackground = svgDataUrl('#c33');
  await page.route('**/published/backgroundCut.json', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      meta: { title: 'Background cut' },
      stage: { background: 'first', orientation: 'landscape' },
      cast: {
        witness: { sprite: 'witness', x: 50, startOffscreen: true }
      },
      props: {},
      script: [
        { do: 'background', name: 'second', orientation: 'landscape', show: ['witness'] },
        { do: 'pause', duration: 0.05 }
      ],
      assets: {
        sprites: {
          'witness-front': svgDataUrl('#69c')
        },
        backgrounds: { first: svgDataUrl('#123'), second: secondBackground },
        props: {},
        audio: {}
      }
    })
  }));

  await page.goto('/skit-player.html?embed=1&skit=backgroundCut');
  await page.locator('#playBtn').click();
  await expect(page.locator('#background')).toHaveAttribute('src', secondBackground);
  await expect(page.locator('#char-witness')).not.toHaveClass(/offscreen/);
  await expect(page.locator('body')).toHaveAttribute('data-playback-state', 'complete');
});

test('caption-only skits enable and display captions automatically', async ({ page }) => {
  const background = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="#123"/></svg>').toString('base64');
  await page.addInitScript(() => localStorage.setItem('ait-tts-mode', 'none'));
  await page.route('**/published/captionOnly.json', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      meta: { title: 'Caption only' },
      stage: { background: 'smoke', orientation: 'landscape' },
      cast: {},
      props: {},
      script: [{ do: 'say', who: 'narrator', line: 'This line has captions and no audio.' }],
      assets: { sprites: {}, backgrounds: { smoke: `data:image/svg+xml;base64,${background}` }, props: {}, audio: {} }
    })
  }));

  await page.goto('/skit-player.html?embed=1&skit=captionOnly');
  await expect(page.locator('body')).not.toHaveClass(/captions-off/);
  await expect(page.locator('#captionBtn')).toHaveClass(/active/);
  await page.locator('#playBtn').click();
  await expect(page.locator('#caption')).toHaveText('This line has captions and no audio.');
  await expect(page.locator('#caption')).toHaveClass(/visible/);
});
