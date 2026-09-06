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
  await expect(page.locator('.pelicans-nav').getByRole('link', { name: 'Create', exact: true })).toBeVisible();
  await expect(page.locator('#skitFrame')).toHaveAttribute('title', 'AI comedy skit player');
});

for (const width of [320,390]) test(`homepage navigation fits wider fallback fonts at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:844});
  await page.goto('/');
  // DejaVu Sans reproduces the GitHub Linux runner's 417px navigation on a 390px phone.
  await page.addStyleTag({content:':root { --font: "DejaVu Sans", sans-serif; }'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const caption=await page.locator('.hero-pelican figcaption').boundingBox();
  expect(caption.x).toBeGreaterThanOrEqual(0);
  for (const control of await page.locator('.pelicans-nav a, .pelicans-nav button').all()) {
    const box=await control.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
  }
  await page.locator('.pelicans-nav').getByRole('link',{name:'Create',exact:true}).click();
  await expect(page).toHaveURL(/agent.html$/);
});
