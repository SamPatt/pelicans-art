const { test, expect } = require('@playwright/test');

test('shows skit action bar after selecting a skit', async ({ page, request }) => {
  const unique = Date.now();
  const title = `playwright-smoke-${unique}`;
  const createSkitResponse = await request.post('/api/skits', {
    data: {
      meta: {
        title,
        description: 'Playwright smoke test skit'
      },
      stage: {
        background: 'apartment',
        orientation: 'landscape'
      },
      cast: {
        narrator: {
          sprite: 'cat',
          x: 50,
          y: 88,
          scale: 1
        }
      },
      props: {},
      script: [
        {
          do: 'say',
          who: 'narrator',
          line: 'Smoke test line.',
          duration: 1
        }
      ]
    }
  });

  expect(createSkitResponse.ok()).toBeTruthy();
  const createdSkit = await createSkitResponse.json();
  const skitId = createdSkit.id;

  try {
    await page.goto('/editor?mode=server');

    const skitItem = page.locator(`.skit-item[data-id="${skitId}"]`);
    await expect(skitItem).toBeVisible();
    await skitItem.click();

    await expect(page.locator('#skit-editor-panel')).toBeVisible();
    await expect(page.locator('#skit-action-bar')).toBeVisible();
    await expect(page.locator('#skit-save-btn')).toBeVisible();
    await expect(page.locator('#skit-preview-btn')).toBeVisible();
    await expect(page.locator('#skit-pouch-btn')).toBeVisible();
    await expect(page.locator('#skit-render-btn')).toBeVisible();

    const layout = await page.evaluate(() => {
      const panel = document.getElementById('skit-editor-panel');
      const bar = document.getElementById('skit-action-bar');
      if (!panel || !bar) return null;
      const panelRect = panel.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      return {
        panelTop: panelRect.top,
        panelBottom: panelRect.bottom,
        panelHeight: panelRect.height,
        barTop: barRect.top,
        barBottom: barRect.bottom,
        barHeight: barRect.height
      };
    });

    expect(layout).not.toBeNull();
    expect(layout.panelHeight).toBeGreaterThan(120);
    expect(layout.barHeight).toBeGreaterThan(30);
    expect(layout.barTop).toBeGreaterThanOrEqual(layout.panelTop - 1);
    expect(layout.barBottom).toBeLessThanOrEqual(layout.panelBottom + 1);
  } finally {
    if (skitId) {
      await request.delete(`/api/skits/${encodeURIComponent(skitId)}`);
    }
  }
});
