import { describe, expect, it } from 'vitest';
import { getSkit, getSprite, getSpriteVariant } from './storage.js';

describe('storage path validation', () => {
  it.each([
    ['skit id', () => getSkit('../outside')],
    ['sprite name', () => getSprite('..')],
    ['variant name', () => getSpriteVariant('cat', '../front')]
  ])('rejects an unsafe %s before filesystem access', async (_label, operation) => {
    await expect(operation()).rejects.toMatchObject({ status: 400 });
  });
});
