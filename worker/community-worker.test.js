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
