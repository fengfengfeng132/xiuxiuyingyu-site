import { describe, expect, it } from 'vitest';
import { buildSpellingFeedback } from '../src/lib/spellingFeedback';

describe('spellingFeedback', () => {
  it('treats an exact spelling as fully correct', () => {
    const result = buildSpellingFeedback('cake', 'cake');

    expect(result.isCorrect).toBe(true);
    expect(result.typedLetters).toEqual([
      { char: 'c', isWrong: false },
      { char: 'a', isWrong: false },
      { char: 'k', isWrong: false },
      { char: 'e', isWrong: false },
    ]);
  });

  it('marks wrong and missing letters in the child answer', () => {
    const result = buildSpellingFeedback('cak', 'cake');

    expect(result.isCorrect).toBe(false);
    expect(result.typedLetters).toEqual([
      { char: 'c', isWrong: false },
      { char: 'a', isWrong: false },
      { char: 'k', isWrong: false },
      { char: '＿', isWrong: true },
    ]);
  });

  it('marks extra letters as wrong', () => {
    const result = buildSpellingFeedback('cakes', 'cake');

    expect(result.isCorrect).toBe(false);
    expect(result.typedLetters).toEqual([
      { char: 'c', isWrong: false },
      { char: 'a', isWrong: false },
      { char: 'k', isWrong: false },
      { char: 'e', isWrong: false },
      { char: 's', isWrong: true },
    ]);
  });
});
