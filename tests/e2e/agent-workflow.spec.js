const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
test('agent instructions are discoverable, copyable, and phone-sized',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/editor?mode=browser');
 await page.getByRole('link',{name:/Create with your agent/}).click();
 await expect(page.getByRole('heading',{name:/You chat/})).toBeVisible();
 await page.context().grantPermissions(['clipboard-read','clipboard-write']);await page.getByRole('button',{name:'Copy agent instructions'}).click();
 await expect(page.getByRole('status')).toHaveText('Instructions copied.');
 const prompt=await page.evaluate(()=>navigator.clipboard.readText());
 const zipUrl=prompt.match(/https:\/\/pelicans\.art\/downloads\/[^\s]+\.zip/)[0];
 const receiptUrl=prompt.match(/https:\/\/pelicans\.art\/downloads\/[^\s]+\.json/)[0];
 const receipt=await (await page.request.get(new URL(receiptUrl).pathname)).json();
 const zip=await (await page.request.get(new URL(zipUrl).pathname)).body();
 expect(require('node:crypto').createHash('sha256').update(zip).digest('hex')).toBe(receipt.sha256);
 expect(receipt.ref).toMatch(/^[a-f0-9]{40}$/);
 expect(prompt).toContain('pelican-theater/SKILL.md');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 const download=await page.request.get('/downloads/pelican-theater-1.0.3.zip');expect(download.ok()).toBe(true);expect((await download.body()).subarray(0,2).toString()).toBe('PK');
});
test('agent bundle imports into editable browser assets and exports unchanged recorded audio',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('ait-welcome-dismissed','1'));
 await page.goto('/editor?mode=browser');
 const file=path.resolve('src/published/theDescription.json');const source=JSON.parse(fs.readFileSync(file,'utf8'));
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Import agent project',exact:true}).click();await (await chooser).setFiles(file);
 await expect(page.locator('#status-left')).toContainText('Agent project imported');
 const result=await page.evaluate(async()=>{
   const skits=await window.backend.listSkits();const id=skits[0].id;
   const skit=await window.backend.getSkit(id);skit.script.push({do:'pause',duration:0.1});await window.backend.saveSkit(id,skit);
   const status=await window.backend.publishSkit(id);const bundle=await window.backend.getPublished(id);
   return {status,audio:bundle.assets.audio,model:bundle.meta.model,cast:bundle.cast};
 });
 expect(result.status.complete).toBe(true);expect(result.audio).toEqual(source.assets.audio);expect(result.model).toBe(source.meta.model);expect(Object.keys(result.cast)).toEqual(Object.keys(source.cast));
});

for(const width of [360,390,768,1024,1440]) test(`homepage links remain clickable around the pelican at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/');
 const tour=page.locator('.hero').getByRole('link',{name:'How it works',exact:true});
 await tour.click();await expect(page).toHaveURL(/how-it-works.html$/);
 await page.getByRole('link',{name:'pelican-theater skill to your agent'}).click();await expect(page).toHaveURL(/agent.html$/);
 await page.goto('/');await page.locator('.hero').getByRole('link',{name:'Make a skit with your agent'}).click();await expect(page).toHaveURL(/agent.html$/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
