const {test,expect}=require('@playwright/test');
test('The Description is featured in both players and other skits remain selectable',async({page})=>{
 await page.goto('/');
 await expect(page.locator('video source')).toHaveAttribute('src','media/the-description.mp4');
 await expect(page.locator('video')).toHaveAttribute('poster','media/the-description-cover.png');
 await expect(page.locator('#skitFrame')).toHaveAttribute('src',/skit=theDescription/);
 await expect(page.locator('.script-tab.active')).toHaveText('The Description');
 await expect(page.locator('.hero-pelican img')).toHaveAttribute('src','media/pelican-emcee.svg');
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

test('homepage mobile skit selection reserves controls below landscape and portrait scenes',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const remote='https://pelicans-community.sam-cloudflare-d20.workers.dev/api/community/published/all-that-glitters-08f42a/data.json';
 // Keep CI independent of the Pouch while exercising its URL-based selection.
 await page.route(remote,route=>route.fulfill({json:{meta:{title:'All That Glitters'},stage:{orientation:'landscape'},cast:[],props:[],script:[],assets:{}}}));
 await page.goto('/');
 for(const [name,param,value,portrait] of [
  ['The Description','skit','theDescription',false],
  ['Bats Don’t Eat Lettuce','skit','batsDontEatLettuce',true],
  ['The Box','skit','theBox',false],
  ['All That Glitters','url',remote,false]
 ]){
  await page.getByRole('button',{name,exact:true}).click();
  await expect.poll(()=>page.frames().some(f=>new URL(f.url()||'about:blank').searchParams.get(param)===value)).toBe(true);
  const frame=page.frames().find(f=>new URL(f.url()||'about:blank').searchParams.get(param)===value);
  await expect(frame.locator('#playBtn')).toBeEnabled();
  await expect(frame.locator('body')).toHaveClass(/controls-below/);
  await expect.poll(()=>page.locator('.stage-container').evaluate(el=>el.classList.contains('portrait'))).toBe(portrait);
  await expect.poll(()=>frame.evaluate(()=>{const r=document.querySelector('#viewport').getBoundingClientRect();return Math.abs(r.height-r.width*(document.querySelector('#viewport').classList.contains('landscape')?9/16:16/9));})).toBeLessThan(1);
  const bounds=await frame.evaluate(()=>{
   const scene=document.querySelector('#viewport').getBoundingClientRect();
   const controls=document.querySelector('#controls').getBoundingClientRect();
   return {width:scene.width,height:scene.height,bottom:scene.bottom,top:controls.top,end:controls.bottom,heightTotal:innerHeight};
  });
  expect(bounds.height).toBeCloseTo(bounds.width*(portrait?16/9:9/16),0);
  expect(bounds.top).toBeGreaterThanOrEqual(bounds.bottom);
  expect(bounds.end).toBeLessThanOrEqual(bounds.heightTotal);
  const frameBox=await page.locator('#skitFrame').boundingBox();
  const tabsBox=await page.locator('#skitSelector').boundingBox();
  expect(tabsBox.y).toBeGreaterThanOrEqual(frameBox.y+frameBox.height);
 }
});
