import { describe, expect, it } from 'vitest';
import { assessSpokenText, normalizeEnglishSpeechText } from '../src/lib/speechAssessment';

describe('speechAssessment', () => {
  it('normalizes English text for comparison', () => {
    expect(normalizeEnglishSpeechText("I'm   listening!")).toBe('im listening');
    expect(normalizeEnglishSpeechText('Who?')).toBe('who');
  });

  it('passes clearly matched word pronunciation text', () => {
    const result = assessSpokenText('write', 'write');
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(78);
  });

  it('fails unrelated spoken text', () => {
    const result = assessSpokenText('listen', 'banana');
    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThan(70);
  });

  it('passes close sentence reading', () => {
    const result = assessSpokenText('How do we play the guitar', 'how do we play guitar');
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(70);
  });
});
