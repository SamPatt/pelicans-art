import {setTimeout as sleep} from 'node:timers/promises';
import {synthesize} from './project.mjs';

function causeCode(error) {
  if (typeof error?.code === 'string') return error.code;
  if (error?.cause) return causeCode(error.cause);
  return error?.errors?.map(causeCode).find(Boolean);
}
export function speechFailure(error) {
  const code = causeCode(error);
  if (error.status) return {kind:'http',status:error.status,message:`Speech endpoint returned HTTP ${error.status}`,retryable:false};
  if (error.name === 'TimeoutError' || ['ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT'].includes(code)) return {kind:'timeout',code:code || 'TIMEOUT',message:'Speech request timed out; service readiness is unknown',retryable:true};
  if (code === 'ECONNREFUSED') return {kind:'connection_refused',code,message:'Connection refused; the speech service may not have started listening yet',retryable:true};
  if (['ECONNRESET','UND_ERR_SOCKET','EPIPE'].includes(code)) return {kind:'connection',code,message:'Speech connection closed before completion',retryable:true};
  if (code === 'INVALID_AUDIO') return {kind:'invalid_audio',code,message:'Speech response is not decodable audio',retryable:false};
  if (['ENOTFOUND','EAI_AGAIN'].includes(code)) return {kind:'dns',code,message:'Speech endpoint hostname could not be resolved',retryable:false};
  if (code === 'ENOENT') return {kind:'missing_tool',code,message:'Speech verification requires ffprobe',retryable:false};
  return {kind:'request',...(code ? {code} : {}),message:'Speech request failed; check endpoint configuration and service logs',retryable:false};
}
export async function probeSpeech(endpoint, {waitMs=0}={}) {
  const started=Date.now();
  let safeEndpoint;
  try {
    const url=new URL(endpoint);
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid endpoint');
    safeEndpoint=url.origin+url.pathname; // Do not echo query-string tokens or URL credentials.
  } catch {return {ok:false,attempts:0,elapsedMs:0,kind:'configuration',message:'Use an HTTP(S) speech endpoint without URL credentials'};}
  if (!Number.isFinite(waitMs) || waitMs<0 || waitMs>300_000) throw new Error('Speech wait must be between 0 and 300000 milliseconds');
  const deadline=started+(waitMs || 120_000);
  let attempts=0;
  while (true) {
    attempts++;
    try {
      await synthesize({engine:'pocket',endpoint,textPrefix:''},'The theater is ready.','alba',{timeoutMs:Math.max(1,deadline-Date.now())});
      return {ok:true,endpoint:safeEndpoint,attempts,elapsedMs:Date.now()-started};
    } catch(error) {
      const failure=speechFailure(error), remaining=deadline-Date.now();
      if (!waitMs || !failure.retryable || remaining<=0) return {ok:false,endpoint:safeEndpoint,attempts,elapsedMs:Date.now()-started,...failure};
      await sleep(Math.min(500*2**Math.min(attempts-1,2),remaining));
      if (Date.now()>=deadline) return {ok:false,endpoint:safeEndpoint,attempts,elapsedMs:Date.now()-started,...failure};
    }
  }
}
