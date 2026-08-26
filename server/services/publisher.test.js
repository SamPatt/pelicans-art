import { describe, expect, it } from 'vitest';
import { resolveVoice } from './publisher.js';

describe('publisher voice casting', () => {
  it('prefers the voice cast by the skit over the sprite default', () => {
    expect(resolveVoice(
      { voice: 'azelma' },
      { voice: { id: 'marius' } }
    )).toBe('azelma');
  });

  it('falls back from the sprite default to alba', () => {
    expect(resolveVoice({}, { voice: { id: 'javert' } })).toBe('javert');
    expect(resolveVoice({}, {})).toBe('alba');
  });
});
