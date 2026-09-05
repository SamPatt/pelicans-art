const { test, expect } = require('@playwright/test');

test('The Description conceals its observer, reveals him, and restores props on replay', async ({ page }) => {
  test.setTimeout(80_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/skit-player.html?embed=1&captions=1&skit=theDescription');
  await expect(page.locator('body')).toHaveAttribute('data-playback-state', 'ready');
  await page.evaluate(() => {
    window.descriptionLines = [];
    window.addEventListener('ai-improv:audio-start', e => window.descriptionLines.push(e.detail.lineIndex));
  });
  await page.getByRole('button', { name: 'Play skit', exact: true }).click();
  await expect(page.locator('#caption')).toContainText('wearing a striped shirt and a mask.');
  const opening = await page.evaluate(() => {
    const observer = document.querySelector('#char-officer');
    const observerRect = observer.getBoundingClientRect();
    const viewport = document.querySelector('#viewport').getBoundingClientRect();
    return { observerPresent: getComputedStyle(observer).opacity === '1', outside: observerRect.right <= viewport.left };
  });
  expect(opening).toEqual({ observerPresent: true, outside: true });
  const radio = page.locator('#char-burglar [data-mounted-prop="scanner"]');
  await expect(radio).toHaveClass(/animate-radio/);
  await expect(radio.locator('text')).toHaveCount(0);
  expect(await radio.locator('.radio-signal').evaluate(el => getComputedStyle(el).animationName)).toBe('radio-signal');
  await expect(page.locator('#caption')).toHaveText("Oh man, I'd better change.", { timeout: 15_000 });
  await expect(radio).not.toHaveClass(/animate-radio/);
  await expect(page.locator('#caption')).toContainText('red floral shirt', { timeout: 20_000 });
  await expect(page.locator('#char-burglar')).toHaveClass(/offscreen/);
  await expect(page.locator('#char-disguise')).not.toHaveClass(/offscreen/);
  await expect(page.locator('#char-disguise [data-mounted-prop="scanner"]')).toHaveClass(/animate-radio/);
  await expect(page.locator('#char-burglar [data-mounted-prop="scanner"]')).toHaveCount(0);
  await expect(page.locator('#caption')).toContainText('finally noticed me', { timeout: 25_000 });
  const revealed = await page.evaluate(() => {
    const r = document.querySelector('#char-officer').getBoundingClientRect();
    const v = document.querySelector('#viewport').getBoundingClientRect();
    return r.left >= v.left && r.right <= v.right;
  });
  expect(revealed).toBe(true);
  await expect(page.locator('#char-turned')).not.toHaveClass(/offscreen/);
  await expect(page.locator('#char-turned')).toHaveClass(/facing-right/);
  await expect(page.locator('#char-turned #head-turn')).toHaveAttribute('transform', 'translate(80 0) scale(-0.8 1)');
  const behind = await page.evaluate(() => document.querySelector('#char-officer').getBoundingClientRect().right < document.querySelector('#char-turned').getBoundingClientRect().left);
  expect(behind).toBe(true);
  await expect(page.locator('#char-officerPlain')).not.toHaveClass(/offscreen/, { timeout: 6_000 });
  await expect(page.locator('#char-officer')).toHaveClass(/offscreen/);
  await expect(page.locator('#caption')).toHaveText("You could've said something.");
  await expect(page.locator('body')).toHaveAttribute('data-playback-state', 'complete', { timeout: 15_000 });
  expect(await page.evaluate(() => window.descriptionLines)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  await page.getByRole('button', { name: 'Play skit', exact: true }).click();
  await expect(page.locator('#caption')).toContainText('wearing a striped shirt and a mask.');
  await expect(page.locator('#prop-loot')).not.toHaveClass(/hidden/);
  await expect(page.locator('#prop-scanner')).not.toHaveClass(/hidden/);
  await expect(page.locator('#char-burglar [data-mounted-prop="scanner"]')).toHaveClass(/animate-radio/);
  expect(errors).toEqual([]);
});

test('long scanner captions leave the picture visible on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/skit-player.html?captions=1&skit=theDescription');
  await expect(page.locator('body')).toHaveAttribute('data-playback-state', 'ready');
  await page.getByRole('button', { name: 'Play skit', exact: true }).click();
  await expect(page.locator('#caption')).toContainText('red floral shirt', { timeout: 20_000 });
  const layout = await page.evaluate(() => {
    const caption = document.querySelector('#caption').getBoundingClientRect();
    const viewport = document.querySelector('#viewport').getBoundingClientRect();
    return { captionFraction: caption.height / viewport.height, inside: caption.top >= viewport.top && caption.bottom <= viewport.bottom, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  expect(layout.captionFraction).toBeLessThan(.3);
  expect(layout.inside).toBe(true);
  expect(layout.overflow).toBe(false);
});
