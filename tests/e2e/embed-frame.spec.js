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

test('share-page controls stay below the complete scene in landscape and portrait',async({page})=>{
  for(const [width,sceneHeight,landscape] of [[350,197,true],[390,693,false]]){
    await page.setViewportSize({width,height:sceneHeight+56});
    await page.goto('/skit-player.html?embed=1&controls=below&skit=theDescription');
    await expect(page.locator('body')).toHaveAttribute('data-playback-state','ready');
    if(!landscape)await page.locator('#viewport').evaluate(el=>el.classList.remove('landscape'));
    const bounds=await page.evaluate(()=>{
      const scene=document.querySelector('#viewport').getBoundingClientRect();
      const controls=document.querySelector('#controls').getBoundingClientRect();
      return {height:scene.height,bottom:scene.bottom,controlsTop:controls.top,controlsBottom:controls.bottom};
    });
    expect(bounds.height).toBeCloseTo(sceneHeight,0);
    expect(bounds.controlsTop).toBeGreaterThanOrEqual(bounds.bottom);
    expect(bounds.controlsBottom).toBeLessThanOrEqual(sceneHeight+56);
  }
});
