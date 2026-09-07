import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessPacing} from '../../scripts/theater/pacing.mjs';
test('pacing identifies fast speech, short gaps and intentional overlap without failing a render',()=>{
 const bundle={script:[{do:'say',who:'captain',line:'Can you move this ship?'},{do:'pause',duration:0.5},{do:'say',who:'duck',line:'Yes, eventually.'},{do:'say',who:'captain',line:'Good.'}]};
 const manifest={dialogueTiming:[{lineIndex:0,offsetMs:0,durationSeconds:.864},{lineIndex:1,offsetMs:1068,durationSeconds:2},{lineIndex:2,offsetMs:2900,durationSeconds:.1}]};
 const before=JSON.stringify({bundle,manifest});const p=assessPacing(bundle,manifest);
 assert.equal(p.advisory,true);assert.deepEqual(p.reviewLines,[0,1]);assert.deepEqual(p.lines[0].reasons,['fast-recording','short-response-gap']);assert.deepEqual(p.lines[1].reasons,['overlapping-recordings']);assert.deepEqual(p.lines[2].reasons,[]);assert.equal(JSON.stringify({bundle,manifest}),before);
});
test('missing legacy durations and caption-only speech remain explicitly unmeasured',()=>{
 const b={script:[{do:'say',who:'a',line:'One two three four.'}]};const p=assessPacing(b,{dialogueTiming:[{lineIndex:0,offsetMs:0}]});assert.deepEqual(p.unmeasuredLines,[0]);assert.equal(p.lines[0].wordsPerMinute,null);assert.deepEqual(p.reviewLines,[]);assert.deepEqual(assessPacing({script:[]},{}).lines,[]);
});
