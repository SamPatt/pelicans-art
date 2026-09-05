import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSvg } from './community-worker.js';

const safeSvg = '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="paint"/></defs><rect fill="url(#paint)"/></svg>';

test('accepts internal SVG references used by animation assets', () => {
  assert.equal(validateSvg(safeSvg), null);
});

for (const [label, svg] of [
  ['script', '<svg><script>alert(1)</script></svg>'],
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

import worker, { assetModel } from './community-worker.js';
import { renderSharePage } from './share-page.js';
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
