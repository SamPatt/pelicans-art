const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
test('agent instructions are discoverable, copyable, and phone-sized',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/editor?mode=browser');
 await page.getByRole('link',{name:/Create with your agent/}).click();
 await expect(page.getByRole('heading',{name:/You chat/})).toBeVisible();
 await page.context().grantPermissions(['clipboard-read','clipboard-write']);await page.getByRole('button',{name:'Copy agent instructions'}).click();
 await expect(page.getByRole('status')).toHaveText('Instructions copied.');
 expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('skills/pelican-theater/SKILL.md');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 const download=await page.request.get('/downloads/pelican-theater-1.0.0.zip');expect(download.ok()).toBe(true);expect((await download.body()).subarray(0,2).toString()).toBe('PK');
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
