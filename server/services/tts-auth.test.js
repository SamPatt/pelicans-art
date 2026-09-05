import { describe, it, expect } from 'vitest';
import { proxyAuthHeaders } from './tts-auth.js';
const configured = { endpoint: 'https://private.example/tts', token: 'test-server-secret' };
const request = (url) => ({ target: new URL(url), preset: 'hermes-piper', authHeader: 'X-Attacker-Choice' });
describe('TTS relay credentials', () => {
  it('does not disclose a server token to a caller-selected URL', () => {
    for (const url of ['https://other.example/tts', 'https://private.example/other', 'https://private.example/tts?redirect=evil']) {
      expect(proxyAuthHeaders(request(url), configured)).toEqual({});
    }
  });
  it('uses the configured header only for the exact configured endpoint', () => {
    expect(proxyAuthHeaders(request(configured.endpoint), configured)).toEqual({ 'X-Watch-Token': 'test-server-secret' });
  });
  it('supports caller-supplied credentials and endpoints without authentication', () => {
    expect(proxyAuthHeaders({ ...request('https://other.example/tts'), authToken: 'test-client-secret' }, configured)).toEqual({ 'X-Attacker-Choice': 'test-client-secret' });
    expect(proxyAuthHeaders(request('http://localhost:8001/tts'))).toEqual({});
  });
});
