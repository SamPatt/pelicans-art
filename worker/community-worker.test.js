import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSvg } from './community-worker.js';

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
  }), {BUCKET:{put:async()=>{writes++;}}});
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
    const records=[]; const env={BUCKET:{put:async(...args)=>records.push(args)}};
    const response=await worker.fetch(new Request(`https://example.com/api/community/${category}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'test',model:'GPT-6 Astra',...body})}),env);
    assert.equal(response.status,201,`${category}: ${await response.text()}`);
    assert.ok(records.length > 0);
    for (const record of records) assert.equal(record[2].customMetadata.model,'GPT-6 Astra');
  }
});
