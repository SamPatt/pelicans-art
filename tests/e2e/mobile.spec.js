const { test, expect } = require('@playwright/test');

test.use({ viewport: { width: 390, height: 844 } });

test('homepage fits a phone viewport and keeps the viewer accessible', async ({ page }) => {
  await page.goto('/');

  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    heroDirection: getComputedStyle(document.querySelector('.hero')).flexDirection,
    modeColumns: getComputedStyle(document.querySelector('.modes-section')).gridTemplateColumns
  }));

  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.heroDirection).toBe('column');
  expect(layout.modeColumns.trim().split(/\s+/)).toHaveLength(1);
  await expect(page.locator('.nav-studio-link')).toBeHidden();
  await expect(page.locator('#skitFrame')).toHaveAttribute('title', 'AI comedy skit player');
});
