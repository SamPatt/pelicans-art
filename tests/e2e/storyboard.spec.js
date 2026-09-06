const {test,expect}=require('@playwright/test');
test('storyboard format, approval, editing and export stay in sync without generation',async({page})=>{
 const mutations=[];page.on('request',r=>{if(r.method()!=='GET')mutations.push(r.url());});
 await page.setViewportSize({width:390,height:844});await page.goto('/storyboard.html');
 await expect(page.locator('#orientation')).toHaveValue('portrait');await expect(page.locator('.scene')).toHaveCount(4);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const ratio=()=>page.locator('.panel').first().evaluate(e=>{let r=e.getBoundingClientRect();return r.width/r.height;});
 expect(await ratio()).toBeCloseTo(9/16,1);
 await page.locator('#orientation').selectOption('landscape');expect(await ratio()).toBeCloseTo(16/9,1);
 await page.locator('#approve').click();await expect(page.locator('#review-status')).toContainText('Approved revision');
 await expect(page.locator('#handoff')).toHaveValue(/Create this reviewed skit/);
 await page.getByRole('textbox',{name:'Scene 1 line 1',exact:true}).fill('Who ordered the suspicious latte?');
 await expect(page.locator('#review-status')).toContainText('Draft revision');await expect(page.locator('#handoff')).toHaveValue(/Do not generate artwork/);
 await page.reload();await expect(page.locator('#orientation')).toHaveValue('landscape');await expect(page.getByRole('textbox',{name:'Scene 1 line 1',exact:true})).toHaveValue('Who ordered the suspicious latte?');
 const download=page.waitForEvent('download');await page.locator('#download').click();const f=await download;expect(f.suggestedFilename()).toBe('storyboard.json');
 await page.locator('#title').fill('Changed title');await page.locator('#file').setInputFiles(await f.path());await expect(page.locator('#title')).toHaveValue('Witness Perk-tection');
 await page.locator('#approve').click();await page.locator('#copy').click();await expect(page.locator('#notice')).toContainText(/copied|Select and copy/);
 expect(mutations).toEqual([]);
});
test('storyboard rejects a bad import without losing the open draft',async({page})=>{
 await page.goto('/storyboard.html');await expect(page.locator('#title')).toHaveValue('Witness Perk-tection');
 await page.locator('#file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"kind":"unexpected"}')});
 await expect(page.locator('#notice')).toContainText('not a rendered project');await expect(page.locator('#title')).toHaveValue('Witness Perk-tection');
});
