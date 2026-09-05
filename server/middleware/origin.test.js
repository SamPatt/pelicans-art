import { describe, it, expect } from 'vitest';
import { isAllowedOrigin } from './origin.js';
const request = (origin, host = '127.0.0.1:3000') => ({ headers: { origin, host }, socket: {} });
describe('private studio browser access', () => {
  it('allows same-origin browsers and CLI clients', () => {
    expect(isAllowedOrigin(request('http://127.0.0.1:3000'))).toBe(true);
    expect(isAllowedOrigin(request(undefined))).toBe(true);
  });
  it('blocks cross-site writes, opaque origins, and wildcard configuration', () => {
    for (const origin of ['https://evil.example', 'null', 'http://127.0.0.1:3000.evil.example']) {
      expect(isAllowedOrigin(request(origin), '*')).toBe(false);
    }
  });
  it('allows an explicitly configured HTTPS preview, not a spoofed forwarded host', () => {
    const req = request('https://studio.example');
    req.headers['x-forwarded-host'] = 'studio.example';
    expect(isAllowedOrigin(req)).toBe(false);
    expect(isAllowedOrigin(req, 'https://studio.example, https://another.example')).toBe(true);
  });
});
