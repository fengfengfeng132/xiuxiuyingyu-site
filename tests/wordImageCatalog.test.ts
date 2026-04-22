import { describe, expect, it } from 'vitest';
import { createWordImageCacheKey, getProjectWordImage } from '../src/lib/wordImageCatalog';

describe('wordImageCatalog', () => {
  it('returns a built-in project image for today dictation words', () => {
    expect(getProjectWordImage(' hot ')).toBe('/images/dictation-words/hot.webp');
    expect(getProjectWordImage('same')).toBe('/images/dictation-words/same.webp');
    expect(getProjectWordImage('unknown')).toBeNull();
  });

  it('separates cache keys by normalized hint text', () => {
    expect(createWordImageCacheKey('too', 'Me too')).toBe(createWordImageCacheKey(' too ', '  me   too  '));
    expect(createWordImageCacheKey('too', 'me too')).not.toBe(createWordImageCacheKey('too', 'too much'));
  });
});
