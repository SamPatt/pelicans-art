const {test,expect}=require('@playwright/test');
test('The Description is featured in both players and other skits remain selectable',async({page})=>{
 await page.goto('/');
 await expect(page.locator('video source')).toHaveAttribute('src','media/the-description.mp4');
 await expect(page.locator('video')).toHaveAttribute('poster','media/the-description-cover.png');
 await expect(page.locator('#skitFrame')).toHaveAttribute('src',/skit=theDescription/);
 await expect(page.locator('.script-tab.active')).toHaveText('The Description');
 await expect(page.locator('.hero-pelican img')).toHaveAttribute('src','sprites/description-disguise/front.svg');
 await page.getByRole('button',{name:'The Box',exact:true}).click();
 await expect(page.locator('#skitFrame')).toHaveAttribute('src',/skit=theBox/);
 await expect(page.getByRole('button',{name:'The Box',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.frameLocator('#skitFrame').locator('body')).toHaveAttribute('data-playback-state','ready');
});
test('small phones and reduced-motion users get a usable homepage',async({page})=>{
 await page.setViewportSize({width:320,height:700});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.locator('.hero-pelican img').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await page.locator('#themeToggle').click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','ocean');
 await expect(page.getByRole('link',{name:'Watch & share'})).toBeVisible();
});
