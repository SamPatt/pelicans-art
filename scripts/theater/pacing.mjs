// Editorial hints only. Durations come from decoded playback, with speed/pitch
// already applied; they include silence inside recordings, not just speech.
export function assessPacing(bundle,manifest){
 const thresholds={shortGapSeconds:0.25,fastWordsPerMinute:240,minimumWords:3};
 const speech=bundle.script.filter(b=>b.do==='say');
 const timing=new Map((manifest.dialogueTiming||[]).map(t=>[t.lineIndex,t]));
 const lines=speech.map((beat,lineIndex)=>{
  const t=timing.get(lineIndex),next=timing.get(lineIndex+1);
  const duration=t?.durationSeconds;
  const known=Number.isFinite(duration)&&duration>0&&Number.isFinite(t?.offsetMs);
  const wordCount=(beat.line.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)||[]).length;
  const wordsPerMinute=known?wordCount*60/duration:null;
  const gapAfterSeconds=known&&Number.isFinite(next?.offsetMs)?(next.offsetMs-t.offsetMs)/1000-duration:null;
  const reasons=[];
  if(wordsPerMinute>thresholds.fastWordsPerMinute&&wordCount>=thresholds.minimumWords)reasons.push('fast-recording');
  if(gapAfterSeconds!==null&&gapAfterSeconds<thresholds.shortGapSeconds)reasons.push(gapAfterSeconds<-.05?'overlapping-recordings':'short-response-gap');
  return {lineIndex,who:beat.who,text:beat.line,durationSeconds:known?duration:null,wordsPerMinute,gapAfterSeconds,reasons};
 });
 return {advisory:true,thresholds,lines,reviewLines:lines.filter(l=>l.reasons.length).map(l=>l.lineIndex),unmeasuredLines:lines.filter(l=>l.durationSeconds===null).map(l=>l.lineIndex),note:'Editorial hints, not failures. Short exchanges or interruptions may be intentional. Review against the agreed pace; do not automatically slow speech or add pauses. Duration includes silence within each recording. Older captures without durations require a new render for measured pacing.'};
}
