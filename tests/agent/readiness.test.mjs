import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {setTimeout as sleep} from 'node:timers/promises';
import {probeSpeech} from '../../scripts/theater/readiness.mjs';
function wav(){const b=Buffer.alloc(3244);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(3200,40);return b;}
async function serve(t,handler){const server=createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});return {server,endpoint:`http://127.0.0.1:${server.address().port}/tts`};}

test('readiness waits for a delayed listener, then verifies real decodable audio',async t=>{
 const {server,endpoint}=await serve(t,(req,res)=>{req.resume();res.end(wav());});const port=server.address().port;await new Promise(r=>server.close(r));
 const starting=sleep(150).then(()=>new Promise(r=>server.listen(port,'127.0.0.1',r)));
 const result=await probeSpeech(endpoint,{waitMs:3000});await starting;
 assert.equal(result.ok,true);assert.ok(result.attempts>=2);assert.ok(result.elapsedMs>=150);assert.equal(result.endpoint,endpoint);
});
test('immediate probe reports refusal once; waiting refusal stays within its overall deadline',async t=>{
 const {server,endpoint}=await serve(t,()=>{});await new Promise(r=>server.close(r));
 const immediate=await probeSpeech(endpoint);assert.equal(immediate.ok,false);assert.equal(immediate.kind,'connection_refused');assert.equal(immediate.code,'ECONNREFUSED');assert.equal(immediate.attempts,1);
 const waited=await probeSpeech(endpoint,{waitMs:250});assert.equal(waited.ok,false);assert.equal(waited.code,'ECONNREFUSED');assert.ok(waited.elapsedMs>=240);assert.ok(waited.elapsedMs<1000);
});
test('HTTP errors and undecodable audio fail without readiness retries',async t=>{
 for(const [status,body,kind] of [[401,'denied','http'],[503,'unavailable','http'],[200,'not audio','invalid_audio']]) {
  let requests=0;const {endpoint}=await serve(t,(req,res)=>{requests++;req.resume();res.writeHead(status);res.end(body);});
  const result=await probeSpeech(endpoint,{waitMs:2000});assert.equal(result.ok,false);assert.equal(result.kind,kind);assert.equal(result.attempts,1);assert.equal(requests,1);if(kind==='http')assert.equal(result.status,status);
 }
});
test('a connected but stalled response times out without claiming the model is loading',async t=>{
 const {endpoint}=await serve(t,(req,res)=>{req.resume();res.writeHead(200);res.flushHeaders();});
 const result=await probeSpeech(endpoint,{waitMs:250});assert.equal(result.kind,'timeout');assert.ok(result.elapsedMs<1000);assert.match(result.message,/unknown/);
});
test('diagnostics omit URL secrets and invalid credentials never reach a service',async t=>{
 const {endpoint}=await serve(t,(req,res)=>{req.resume();res.writeHead(401);res.end();});
 const result=await probeSpeech(endpoint+'?token=secret-value');assert.equal(result.endpoint,endpoint);assert.ok(!JSON.stringify(result).includes('secret-value'));
 const invalid=await probeSpeech(endpoint.replace('http://','http://user:secret-value@'));assert.equal(invalid.kind,'configuration');assert.equal(invalid.attempts,0);assert.ok(!JSON.stringify(invalid).includes('secret-value'));
});
