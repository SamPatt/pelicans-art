const {test,expect}=require('@playwright/test');
const paths=['/','/community.html','/agent.html','/how-it-works.html','/skit-player.html?skit=theDescription','/watch/the-description/'];
for(const width of [320,1280]) test(`shared navigation and theme survive page changes at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  // Generated share pages use the public asset origin, including on the Worker.
  await page.route('https://pelicans.art/site.css',route=>route.fulfill({path:'src/site.css',contentType:'text/css'}));
  await page.route('https://pelicans.art/js/site-shell.js',route=>route.fulfill({path:'src/js/site-shell.js',contentType:'text/javascript'}));
  await page.goto('/');
  await page.locator('#themeToggle').click();
  const theme=await page.locator('html').getAttribute('data-theme');
  const background=await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor);
  for(const path of paths){
    await page.goto(path);
    const nav=page.getByRole('navigation',{name:'Main navigation'});
    await expect(nav.locator('.pelicans-nav-links a')).toHaveText(['Watch','The Pouch','Create']);
    await expect(nav.locator('#themeToggle')).toBeVisible();
    expect(await page.locator('html').getAttribute('data-theme')).toBe(theme);
    expect(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe(background);
    for(const link of await nav.locator('a,button').all()){
      const box=await link.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
    }
  }
  await page.goto('/agent.html');
  await page.getByRole('link',{name:'Watch the skits',exact:true}).click();
  await expect(page).toHaveURL(/\/#now-playing$/);
  await page.goto('/skit-player.html?embed=1&skit=theDescription');
  await expect(page.locator('.pelicans-nav')).toBeHidden();
});
