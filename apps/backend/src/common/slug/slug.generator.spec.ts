import { describe, expect, it } from 'vitest';

import { generateSlug } from './slug.generator.js';

const SLUG_REGEX = /^[1-9A-HJ-NP-Za-km-z]{8}$/;
const AMBIGUOUS_CHARS = new Set(['0', 'O', 'I', 'l']);

describe('generateSlug', () => {
  it('returns a string of exactly 8 characters', () => {
    expect(generateSlug()).toHaveLength(8);
  });

  it('uses only base-58 alphabet characters', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateSlug()).toMatch(SLUG_REGEX);
    }
  });

  it('does not include ambiguous characters (0, O, I, l)', () => {
    for (let i = 0; i < 500; i++) {
      const slug = generateSlug();
      for (const char of slug) {
        expect(AMBIGUOUS_CHARS.has(char), `slug "${slug}" contains ambiguous char "${char}"`).toBe(
          false,
        );
      }
    }
  });

  it('produces unique values across repeated calls', () => {
    const slugs = new Set(Array.from({ length: 1000 }, () => generateSlug()));
    expect(slugs.size).toBe(1000);
  });
});
