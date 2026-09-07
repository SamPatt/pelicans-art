const { test, expect } = require('@playwright/test');
const dataSvg = svg => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

async function loadCast(page, orientation = 'landscape') {
  const rock = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200"><path fill="#bbb" d="M10 140 L90 140 L95 195 L5 195Z"/><g transform="translate(0 125)"><ellipse id="eye-left-white" cx="35" cy="35" rx="5" ry="6"/><ellipse id="eye-right-white" cx="65" cy="35" rx="5" ry="6"/><path id="mouth-closed" d="M40 55H60" stroke="black"/></g></svg>';
  const manager = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200"><rect x="20" y="0" width="60" height="200" fill="#456"/><circle id="eye-left-white" cx="40" cy="25" r="5"/><circle id="eye-right-white" cx="60" cy="25" r="5"/><path id="mouth-closed" d="M40 40H60" stroke="black"/></svg>';
  await page.route('**/published/cameraGeometry.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    meta: { title: 'Camera geometry' }, stage: { orientation, background: 'plain' },
    cast: { rock: { sprite: 'rock', x: 35, scale: 0.8 }, manager: { sprite: 'manager', x: 65, scale: 1.3 } },
    props: {}, script: [{ do: 'pause', duration: 1 }],
    assets: { sprites: { 'rock-front': dataSvg(rock), 'manager-front': dataSvg(manager) },
      backgrounds: { plain: dataSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="#ccc"/></svg>') }, props: {}, audio: {} }
  }) }));
  await page.goto('/skit-player.html?embed=1&skit=cameraGeometry');
  await expect(page.locator('body')).toHaveAttribute('data-playback-state', 'ready');
  await page.addStyleTag({ content: '.character svg { animation: none !important; }' });
}

for (const orientation of ['landscape', 'portrait']) {
  test(`${orientation}: closeup centers the transformed low face, not the sprite box`, async ({ page }) => {
    await loadCast(page, orientation);
    const result = await page.evaluate(() => {
      shot('closeup', 'rock');
      const v = document.querySelector('#viewport').getBoundingClientRect();
      const mouth = document.querySelector('#char-rock #mouth-closed').getBoundingClientRect();
      const eyes = document.querySelector('#char-rock #eye-left-white').getBoundingClientRect();
      return { mouthY: (mouth.top - v.top) / v.height, eyesY: (eyes.top - v.top) / v.height };
    });
    expect(result.mouthY).toBeGreaterThan(0.35);
    expect(result.mouthY).toBeLessThan(0.7);
    expect(result.eyesY).toBeGreaterThan(0.2);
    expect(result.eyesY).toBeLessThan(0.65);
  });

  test(`${orientation}: two-shot fits the tall actor; wide restores the entire stage`, async ({ page }) => {
    await loadCast(page, orientation);
    const positions = await page.evaluate(() => {
      shot('two-shot');
      const viewport = document.querySelector('#viewport').getBoundingClientRect();
      return [...document.querySelectorAll('.character svg')].map(svg => {
        const rect = svg.getBoundingClientRect();
        return { top: (rect.top - viewport.top) / viewport.height, bottom: (rect.bottom - viewport.top) / viewport.height,
          left: (rect.left - viewport.left) / viewport.width, right: (rect.right - viewport.left) / viewport.width };
      });
    });
    for (const rect of positions) {
      expect(rect.top).toBeGreaterThanOrEqual(0);
      expect(rect.bottom).toBeLessThanOrEqual(1);
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(1);
    }
    await page.evaluate(() => shot('wide'));
    const stage = await page.locator('#stage').boundingBox();
    const viewport = await page.locator('#viewport').boundingBox();
    expect(stage.width).toBeCloseTo(viewport.width, 0);
    expect(stage.height).toBeCloseTo(viewport.height, 0);
  });
}

test('follow keeps a flipped, offset face framed after movement and repeated cuts', async ({ page }) => {
  await loadCast(page);
  await page.evaluate(() => {
    const el = document.querySelector('#char-rock');
    el.classList.remove('facing-right');
    el.classList.add('facing-left');
    el.querySelector('g').setAttribute('transform', 'translate(15 125)');
    shot('closeup', 'rock');
    shot('two-shot');
    shot('closeup', 'rock');
    moveCharacter('rock', 55, 0.1);
  });
  await expect.poll(() => page.evaluate(() => {
    const v = document.querySelector('#viewport').getBoundingClientRect();
    const face = [...document.querySelectorAll('#char-rock #eye-left-white, #char-rock #eye-right-white, #char-rock #mouth-closed')].map(n => n.getBoundingClientRect());
    const center = (Math.min(...face.map(b => b.left)) + Math.max(...face.map(b => b.right))) / 2;
    return Math.abs((center - v.left) / v.width - 0.5);
  })).toBeLessThan(0.02);
});

test('legacy sprites without face IDs still produce a finite closeup', async ({ page }) => {
  await loadCast(page);
  const transform = await page.evaluate(() => {
    document.querySelectorAll('#char-rock svg [id]').forEach(node => node.removeAttribute('id'));
    shot('closeup', 'rock');
    return document.querySelector('#stage').style.transform;
  });
  expect(transform).toContain('scale(2.2)');
  expect(transform).not.toMatch(/NaN|Infinity/);
});
