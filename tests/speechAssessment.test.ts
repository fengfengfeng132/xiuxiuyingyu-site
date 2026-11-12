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

  it('rejects a single letter contained in a full target word', () => {
    const result = assessSpokenText('elephant', 'a');
    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThan(78);
  });

  it('rejects only one word from a full sentence', () => {
    const result = assessSpokenText('The zebras are scared and they run away.', 'the');
    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThan(70);
  });

  it('accepts a complete sentence and a minor word transcription error', () => {
    expect(assessSpokenText('The zebras are scared and they run away.', 'the zebras are scared and they run away').passed).toBe(true);
    expect(assessSpokenText('elephant', 'elephent').passed).toBe(true);
  });
});
