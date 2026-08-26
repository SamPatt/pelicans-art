import { describe, expect, it } from 'vitest';
import { validateSkit, validateSpriteSvg } from './validate.js';

describe('validateSkit', () => {
  it('accepts a minimal playable skit', () => {
    const result = validateSkit({
      stage: { background: 'apartment' },
      cast: { cat: { sprite: 'cat', x: 50 } },
      props: {},
      script: [
        { do: 'emote', who: 'cat', emotion: 'happy' },
        { do: 'say', who: 'cat', line: 'Meow.' }
      ]
    });

    expect(result).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('rejects broken character and prop references', () => {
    const result = validateSkit({
      stage: { background: 'apartment' },
      cast: { cat: { sprite: 'cat', x: 50 } },
      props: {},
      script: [
        { do: 'say', who: 'dog', line: 'Woof.' },
        { do: 'spawn', what: 'missing-prop' }
      ]
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Script beat 0: unknown character "dog"');
    expect(result.errors).toContain('Script beat 1: unknown prop "missing-prop"');
  });
});

describe('validateSpriteSvg', () => {
  it('reports missing animation anchors', () => {
    const result = validateSpriteSvg('<svg viewBox="0 0 100 150"></svg>');

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required group: body');
    expect(result.errors).toContain('Missing required element: mouth-open');
  });
});
