const {test,expect}=require('@playwright/test');
test('voice auditions retain editable labels and export usable agent casting notes',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/voices.html');
 await expect(page.locator('.voice-row')).toHaveCount(26);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const label=page.getByRole('textbox',{name:'Your descriptive label: alba',exact:true});
 await expect(label).toHaveValue('Good male voice, slightly high-pitched, American');
 await label.fill('Calm narrator');await page.getByRole('textbox',{name:'Character / role (optional): alba',exact:true}).fill('Inspector');
 await expect(page.locator('#agent-notes')).toHaveValue(/alba: Calm narrator — cast as Inspector/);
 await page.reload();await expect(label).toHaveValue('Calm narrator');
 await page.locator('#search').fill('Calm narrator');await expect(page.locator('.voice-row:visible')).toHaveCount(1);await page.locator('#search').fill('');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download labels',exact:true}).click();const file=await download;expect(file.suggestedFilename()).toBe('pelican-voice-labels.json');
 await label.fill('Changed');await page.locator('#import-labels').setInputFiles(await file.path());await expect(label).toHaveValue('Calm narrator');
 for(const id of ['alba','marius']){await page.locator(`audio[aria-label="Audition ${id}"]`).evaluate(a=>a.play());}
 expect(await page.locator('audio').evaluateAll(as=>as.filter(a=>!a.paused).length)).toBe(1);
 await page.getByRole('button',{name:'Copy voice choices for your agent'}).click();await expect(page.locator('#status')).toContainText(/copied|Select and copy/);
});
test('every advertised voice audition decodes in the browser',async({page})=>{
 await page.goto('/voices.html');await expect(page.locator('.voice-row')).toHaveCount(26);
 const durations=await page.evaluate(async()=>{const context=new AudioContext();const results=[];for(const a of document.querySelectorAll('audio')){const response=await fetch(a.src);if(!response.ok)throw Error(a.src);const buffer=await context.decodeAudioData(await response.arrayBuffer());results.push(buffer.duration);}await context.close();return results;});
 expect(durations).toHaveLength(26);for(const duration of durations)expect(duration).toBeGreaterThan(2);
});
