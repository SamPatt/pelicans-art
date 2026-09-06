const { test, expect } = require('@playwright/test');

test('SVG sanitizer preserves animation hooks and strips executable content', async ({ page }) => {
  await page.goto('/skit-player.html?embed=1&skit=theBox');

  const result = await page.evaluate(() => {
    window.__svgExecuted = false;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="window.__svgExecuted=true">
        <script>window.__svgExecuted=true</script>
        <style>@import url(https://evil.example/style.css); .safe { fill: url(#paint); }</style>
        <defs><linearGradient id="paint"><stop offset="0" stop-color="red"/></linearGradient></defs>
        <g id="mouth" class="safe" style="stroke:url(https://evil.example/pixel)">
          <a href="javascript:window.__svgExecuted=true"><rect id="mouth-open" width="10" height="10"/></a>
        </g>
        <image href="https://evil.example/tracker.png"/>
      </svg>`;

    window.AITSvgSanitizer.setSvg(host, svg);
    return {
      executed: window.__svgExecuted,
      hasScript: Boolean(host.querySelector('script')),
      hasEventHandler: Boolean(host.querySelector('[onload]')),
      unsafeHrefCount: host.querySelectorAll('[href]').length,
      hasMouth: Boolean(host.querySelector('#mouth-open')),
      styleText: host.querySelector('style')?.textContent || '',
      inlineStyle: host.querySelector('#mouth')?.getAttribute('style') || ''
    };
  });

  expect(result.executed).toBe(false);
  expect(result.hasScript).toBe(false);
  expect(result.hasEventHandler).toBe(false);
  expect(result.unsafeHrefCount).toBe(0);
  expect(result.hasMouth).toBe(true);
  expect(result.styleText).not.toContain('@import');
  expect(result.styleText).toContain('url(#paint)');
  expect(result.inlineStyle).not.toContain('evil.example');
});

test('community skit metadata and dialogue render as text, not markup', async ({ page }) => {
  const payload = '<img src=x onerror="window.__communityExecuted=true">';
  await page.addInitScript(() => { window.__communityExecuted = false; });
  await page.route('https://pelicans-community.sam-cloudflare-d20.workers.dev/api/community/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/skits/test/data.json')) {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          meta: { title: payload, description: payload },
          stage: { background: payload },
          cast: { [payload]: { sprite: 'pelican' } },
          script: [{ do: 'say', who: payload, line: payload }]
        })
      });
    }
    if (url.pathname.endsWith('/skits/test')) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ name: payload, username: 'tester', category: 'skits' }) });
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items: [{ slug: 'test', name: payload, username: 'tester' }], hasMore: false })
    });
  });

  await page.goto('/community.html?type=skits&id=test');
  await expect(page.locator('#detail-title')).toContainText('<img src=x');
  await expect(page.locator('#detail-content')).toContainText('<img src=x');
  expect(await page.evaluate(() => window.__communityExecuted)).toBe(false);
  expect(await page.locator('#detail-content img').count()).toBe(0);
  const report = page.getByRole('link', {name:'Report / request removal'});
  const reportUrl = new URL(await report.getAttribute('href'));
  expect(reportUrl.searchParams.get('asset')).toBe('https://pelicans.art/community.html?type=skits&id=test');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText:async text=>{window.__copiedLink=text;}}});
  });
  await page.getByRole('button', {name:'Copy Link',exact:true}).click();
  expect(await page.evaluate(() => window.__copiedLink)).toContain('community.html?type=skits&id=test');
});
