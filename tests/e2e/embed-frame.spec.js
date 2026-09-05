const {test,expect}=require('@playwright/test');

test('embedded landscape scene fills its frame on phones and desktop',async({page})=>{
  for(const width of [350,500,800]) {
    const height=Math.round(width*9/16);
    await page.setViewportSize({width,height});
    await page.goto('/skit-player.html?embed=1&captions=1&skit=theDescription');
    await expect(page.locator('body')).toHaveAttribute('data-playback-state','ready');
    const bounds=await page.evaluate(()=>{
      const scene=document.querySelector('#viewport').getBoundingClientRect();
      const stage=document.querySelector('#stage').getBoundingClientRect();
      const controls=document.querySelector('#controls').getBoundingClientRect();
      return {width:scene.width,height:scene.height,stageHeight:stage.height,controlsBottom:controls.bottom,scrollHeight:document.documentElement.scrollHeight};
    });
    expect(bounds.width).toBeCloseTo(width,0);
    expect(bounds.height).toBeCloseTo(height,0);
    expect(bounds.stageHeight).toBeCloseTo(height,0);
    expect(bounds.controlsBottom).toBeLessThanOrEqual(height);
    expect(bounds.scrollHeight).toBeLessThanOrEqual(height);
  }
});
