import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSvg } from './community-worker.js';

const uploadLimits = { UPLOAD_LIMITER: {limit: async () => ({success:true})}, UPLOAD_TOTAL_LIMITER: {limit: async () => ({success:true})} };

const safeSvg = '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="paint"/></defs><rect fill="url(#paint)"/></svg>';

test('accepts internal SVG references used by animation assets', () => {
  assert.equal(validateSvg(safeSvg), null);
});

for (const [label, svg] of [
  ['script', '<svg><script>alert(1)</script></svg>'],
  ['namespaced script', '<svg xmlns:s="http://www.w3.org/2000/svg"><s:script>/* probe */</s:script></svg>'],
  ['Unicode-prefixed script', '<svg xmlns:é="http://www.w3.org/2000/svg"><é:script>/* probe */</é:script></svg>'],
  ['Unicode-prefixed namespace declaration', '<svg xmlns:é="http://www.w3.org/1999/xhtml"/>'],
  ['foreign namespace', '<svg xmlns="http://www.w3.org/1999/xhtml"></svg>'],
  ['namespaced foreign content', '<svg xmlns:h="http://www.w3.org/1999/xhtml"><h:iframe/></svg>'],
  ['animated link mutation', '<svg><a id="link" href="#safe"/><set href="#link" attributeName="href" to="javascript:probe()"/></svg>'],
  ['animated URL', '<svg><animate attributeName="href" values="#safe;javascript:probe()"/></svg>'],
  ['external document type', '<!DOCTYPE svg SYSTEM "https://example.com/svg.dtd"><svg/>'],
  ['stylesheet instruction', '<?xml-stylesheet href="https://example.com/style.css"?><svg/>'],
  ['XML base', '<svg xml:base="https://example.com/"><use href="#shape"/></svg>'],
  ['escaped stylesheet URL', '<svg><style>rect {fill: u\\72l(https://example.com/a.svg)}</style></svg>'],
  ['escaped inline CSS URL', '<svg><rect style="fill:u&#92;72l(https://example.com/a.svg)"/></svg>'],
  ['event handler', '<svg onload="alert(1)"></svg>'],
  ['javascript URL', '<svg><a href="javascript:alert(1)"></a></svg>'],
  ['external image', '<svg><image href="https://example.com/pixel.png"/></svg>'],
  ['CSS import', '<svg><style>@import "https://example.com/a.css"</style></svg>'],
  ['external CSS URL', '<svg><rect style="fill:url(https://example.com/a.svg)"/></svg>']
]) {
  test(`rejects ${label}`, () => {
    assert.match(validateSvg(svg), /^Invalid SVG:/);
  });
}

test('retains ordinary SVG styles, gradients, xlink fragments and embedded raster images', () => {
  const svg = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><style>.body {fill:#fff}</style><defs><path id="shape" d="M0 0L10 10"/></defs><use xlink:href="#shape" style="stroke:#123"/><image href="data:image/png;base64,AAAA"/></svg>';
  assert.equal(validateSvg(svg), null);
});

test('retains existing harmless opacity animation', () => {
  assert.equal(validateSvg('<svg><path><animate attributeName="opacity" values="0;1;0" dur="0.15s" repeatCount="indefinite"/></path></svg>'), null);
});

import worker, { assetModel } from './community-worker.js';
import { renderSharePage } from './share-page.js';

test('raw stored SVGs have sandboxed response headers even for legacy unsafe objects', async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:s="http://www.w3.org/2000/svg"><s:script>/* old upload */</s:script></svg>';
  for (const contentType of ['image/svg+xml', 'application/octet-stream']) {
    const env = {BUCKET:{get:async()=>({body:svg,httpMetadata:{contentType}})}};
    const response = await worker.fetch(new Request('https://example.com/api/community/characters/old/front.svg'), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'image/svg+xml; charset=utf-8');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    const policy = response.headers.get('Content-Security-Policy');
    assert.match(policy, /^sandbox;/);
    assert.match(policy, /default-src 'none'/);
    assert.match(policy, /script-src 'none'/);
    assert.ok(!policy.includes('allow-scripts'));
    assert.ok(!policy.includes('allow-same-origin'));
    assert.equal(await response.text(), svg);
  }
});

test('namespaced active SVG uploads are rejected before writing storage', async () => {
  let writes = 0;
  const response = await worker.fetch(new Request('https://example.com/api/community/props', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({username:'test',meta:{name:'Probe'},svg:'<svg xmlns:s="http://www.w3.org/2000/svg"><s:script>/* probe */</s:script></svg>'})
  }), {...uploadLimits,BUCKET:{put:async()=>{writes++;}}});
  assert.equal(response.status, 400);
  assert.equal(writes, 0);
});
test('model provenance accepts all asset payloads and defaults to Unknown', () => {
  for (const body of [{}, {model:''}, {model:42}]) assert.equal(assetModel(body), 'Unknown');
  for (const body of [{model:'GPT-6 Astra'}, {meta:{model:'GPT-6 Astra'}}, {skit:{meta:{model:'GPT-6 Astra'}}}, {published:{meta:{model:'GPT-6 Astra'}}}]) assert.equal(assetModel(body),'GPT-6 Astra');
});
test('share metadata is present without JavaScript and escapes untrusted titles', () => {
  const html = renderSharePage({title:'<script>bad</script>"',description:'A & B',model:'<img>',url:'https://watch.pelicans.art/test',playerUrl:'https://pelicans.art/skit-player.html?embed=1&url=test',image:'https://pelicans.art/media/test.png'});
  assert.ok(html.includes('property="og:title" content="&lt;script&gt;bad&lt;/script&gt;&quot;"'));
  assert.ok(html.includes('Model: &lt;img&gt;'));
  assert.ok(html.includes('property="og:image"'));
  assert.ok(!html.includes('<script>bad'));
});
test('dynamic share pages use the stored skit and return 404 for missing skits', async () => {
  const env = {BUCKET:{get: async key => key === 'published/example.json' ? {text:async()=>JSON.stringify({meta:{title:'Example',model:'Astra'},stage:{orientation:'portrait'}})} : null}};
  const response = await worker.fetch(new Request('https://example.com/watch/example'),env);
  assert.equal(response.status,200);
  const html=await response.text();
  assert.ok(html.includes('<title>Example — pelicans.art</title>'));
  assert.ok(html.includes('aspect-ratio:9/16'));
  assert.ok(html.includes('Model: Astra'));
  assert.equal((await worker.fetch(new Request('https://example.com/watch/missing'),env)).status,404);
});
test('all upload categories preserve model metadata in R2', async () => {
  const bodies = {
    characters:{meta:{name:'Actor'},variants:{front:safeSvg}}, props:{meta:{name:'Prop'},svg:safeSvg}, backgrounds:{name:'Scene',landscape_svg:safeSvg},
    skits:{skit:{meta:{title:'Script'},stage:{background:'scene'},cast:{},script:[]}}, published:{published:{meta:{title:'Skit'},assets:{}}},
    voices:{name:'Voice',safetensors_base64:btoa('123456789')}
  };
  for (const [category,body] of Object.entries(bodies)) {
    const records=[]; const env={...uploadLimits,BUCKET:{put:async(...args)=>records.push(args)}};
    const response=await worker.fetch(new Request(`https://example.com/api/community/${category}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'test',model:'GPT-6 Astra',...body})}),env);
    assert.equal(response.status,201,`${category}: ${await response.text()}`);
    assert.ok(records.length > 0);
    for (const record of records) assert.equal(record[2].customMetadata.model,'GPT-6 Astra');
  }
});

function uploadRequest(body = '{}', headers = {}) {
  return new Request('https://example.com/api/community/props', {
    method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body
  });
}

test('upload limits reject before reading the body or writing storage', async () => {
  for (const binding of ['UPLOAD_LIMITER', 'UPLOAD_TOTAL_LIMITER']) {
    const request = uploadRequest();
    const response = await worker.fetch(request, {
      ...uploadLimits, [binding]: {limit: async () => ({success:false})},
      BUCKET: {put: async () => assert.fail('must not write')}
    });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '60');
    assert.equal(request.bodyUsed, false);
  }
});

test('missing or broken limiters fail closed; emergency pause works', async () => {
  for (const env of [{}, {...uploadLimits, UPLOAD_LIMITER:{limit:async()=>{throw new Error('secret');}}}, {...uploadLimits, UPLOADS_ENABLED:'false'}]) {
    const request = uploadRequest();
    const response = await worker.fetch(request, env);
    assert.equal(response.status, 503);
    assert.equal(request.bodyUsed, false);
    assert.ok(!(await response.text()).includes('secret'));
  }
});

test('all upload categories share the trusted network key, not a spoofable username', async () => {
  const keys = [];
  const env = {...uploadLimits, UPLOAD_LIMITER:{limit: async ({key}) => {keys.push(key);return {success:true};}}};
  for (const category of ['props','characters']) {
    const request = new Request(`https://example.com/api/community/${category}`, {
      method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1','X-Forwarded-For':'spoofed'},body:'{}'
    });
    assert.equal((await worker.fetch(request,env)).status,400);
  }
  assert.deepEqual(keys,['pouch:upload:192.0.2.1','pouch:upload:192.0.2.1']);
});

test('byte limit rejects oversized declared and streamed bodies, including multibyte text', async () => {
  for (const request of [uploadRequest('{}', {'Content-Length':String(3*1024*1024+1)}), uploadRequest('é'.repeat(1600000))]) {
    assert.equal((await worker.fetch(request,uploadLimits)).status,413);
  }
});

test('ordinary Pouch reads remain available without upload limiters', async () => {
  const response = await worker.fetch(new Request('https://example.com/api/community/props/probe/front.svg'), {
    BUCKET:{get:async()=>({body:safeSvg,httpMetadata:{contentType:'image/svg+xml'}})}
  });
  assert.equal(response.status,200);
});

test('moderation requires the admin key and deletes only the exact published asset', async () => {
  const deleted = [];
  const env = {ADMIN_KEY:'test-only-key',BUCKET:{
    list:async()=>({objects:[{key:'published/probe.json'},{key:'published/probe.json-extra'}]}),
    delete:async key=>deleted.push(key)
  }};
  const url = 'https://example.com/api/community/published/probe';
  assert.equal((await worker.fetch(new Request(url,{method:'DELETE'}),env)).status,401);
  assert.deepEqual(deleted,[]);
  assert.equal((await worker.fetch(new Request(url,{method:'DELETE',headers:{'X-Admin-Key':'test-only-key'}}),env)).status,200);
  assert.deepEqual(deleted,['published/probe.json']);
});

test('search context survives uploads, listing, and metadata endpoints without requiring legacy fields', async () => {
  for (const [category, payload] of Object.entries({
    characters:{meta:{name:'Actor'},variants:{front:safeSvg}},
    props:{meta:{name:'Phone'},svg:safeSvg},
    backgrounds:{name:'Cafe',landscape_svg:safeSvg}
  })) {
    const objects=new Map();
    const env={...uploadLimits,BUCKET:{
      put:async(key,body,options)=>objects.set(key,{key,...options,size:body.length,text:async()=>body}),
      get:async key=>objects.get(key),
      list:async()=>({objects:[...objects.values()],truncated:false})
    }};
    const response=await worker.fetch(new Request(`https://example.com/api/community/${category}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,username:'test',description:'A useful scene asset.',tags:['cafe','warm','cafe',42,null]})}),env);
    assert.equal(response.status,201);
    const {slug}=await response.json();
    const listed=await (await worker.fetch(new Request(`https://example.com/api/community/${category}`),env)).json();
    assert.equal(listed.items.length,1);
    const item=listed.items[0];
    assert.equal(item.description,'A useful scene asset.');assert.equal(item.category,category);assert.deepEqual(item.tags,['cafe','warm']);assert.equal(item.model,'Unknown');
    const stored=JSON.parse(await objects.get(`${category}/${slug}/meta.json`).text());
    assert.equal(stored.description,item.description);assert.deepEqual(stored.tags,item.tags);
    const detail=await (await worker.fetch(new Request(`https://example.com/api/community/${category}/${slug}`),env)).json();
    assert.equal(detail.description,item.description);assert.deepEqual(detail.tags,item.tags);
  }
});

import {assetSearchMetadata} from './community-worker.js';
test('search metadata rejects nontext values and bounds Unicode metadata size',()=>{
  assert.deepEqual(assetSearchMetadata({description:{bad:true},tags:'not-an-array'},'props'),{category:'props',description:'',tags:[]});
  const search=assetSearchMetadata({description:'😀'.repeat(1000),tags:Array.from({length:20},(_,i)=>String(i)+'😀'.repeat(100))});
  assert.ok(new TextEncoder().encode(search.description).length<=600);assert.equal(search.tags.length,8);
  assert.ok(search.tags.every(tag=>new TextEncoder().encode(tag).length<=40));
});

test('list distinguishes indexed search metadata from legacy empty defaults',async()=>{
  const objects=[{key:'props/old/meta.json',customMetadata:{}},{key:'props/new/meta.json',customMetadata:{description:'',tags:'[]'}}];
  const env={BUCKET:{list:async()=>({objects,truncated:false})}};
  const {items}=await (await worker.fetch(new Request('https://example.com/api/community/props'),env)).json();
  assert.equal(items[0].searchMetadata,false);assert.equal(items[1].searchMetadata,true);
  assert.equal(items[0].description,'');assert.deepEqual(items[0].tags,[]);
});

test('portrait-only backgrounds are listed and dual variants deduplicated across storage and API pages',async()=>{
  const keys=['backgrounds/both/landscape.svg','backgrounds/both/portrait.svg','backgrounds/portrait/portrait.svg'];
  const objects=keys.map(key=>({key,customMetadata:{assetName:key.split('/')[1]}}));
  const env={BUCKET:{
    head:async key=>objects.find(obj=>obj.key===key),
    get:async key=>objects.find(obj=>obj.key===key),
    list:async({cursor})=>{const i=Number(cursor||0);return {objects:[objects[i]],truncated:i<2,cursor:String(i+1)};}
  }};
  const first=await (await worker.fetch(new Request('https://example.com/api/community/backgrounds?limit=1'),env)).json();
  assert.deepEqual(first.items.map(item=>item.slug),['both']);assert.equal(first.hasMore,true);
  const next=await (await worker.fetch(new Request(`https://example.com/api/community/backgrounds?limit=1&cursor=${first.cursor}`),env)).json();
  assert.deepEqual(next.items.map(item=>item.slug),['portrait']);assert.equal(next.hasMore,false);
  const detail=await (await worker.fetch(new Request('https://example.com/api/community/backgrounds/portrait'),env)).json();
  assert.equal(detail.name,'portrait');
});

test('portrait-only uploads preserve their actual orientation without inventing landscape artwork',async()=>{
  const records=[];const env={...uploadLimits,BUCKET:{put:async(...args)=>records.push(args)}};
  const response=await worker.fetch(new Request('https://example.com/api/community/backgrounds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'test',name:'Tall room',portrait_svg:safeSvg})}),env);
  assert.equal(response.status,201);
  const {files}=await response.json();assert.deepEqual(files,['portrait.svg','meta.json']);
  assert.ok(records.every(([key])=>!key.endsWith('landscape.svg')));
});
