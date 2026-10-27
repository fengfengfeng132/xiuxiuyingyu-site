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

  it.each([
    ["isn't", "isn't"],
    ['isn\u2019t', "isn't"],
    ['isn\u2018t', "isn't"],
    ["aren't", "aren't"],
    ['aren\u2019t', "aren't"],
    ['aren\u2018t', "aren't"],
  ])('accepts %s for %s without changing typed characters', (typedWord, answerWord) => {
    const result = buildSpellingFeedback(typedWord, answerWord);

    expect(result.isCorrect).toBe(true);
    expect(result.typedLetters).toEqual(
      Array.from(typedWord, (char) => ({ char, isWrong: false })),
    );
  });

  it('keeps case-insensitive and trimmed matching for contractions', () => {
    const result = buildSpellingFeedback('  ISN\u2019T  ', " isn't ");

    expect(result.isCorrect).toBe(true);
    expect(result.typedLetters).toEqual(
      Array.from('ISN\u2019T', (char) => ({ char, isWrong: false })),
    );
  });

  it.each(['\u2019', '\u2018'])('preserves %s in feedback while marking a wrong letter', (apostrophe) => {
    const result = buildSpellingFeedback(`isn${apostrophe}x`, "isn't");

    expect(result.isCorrect).toBe(false);
    expect(result.typedLetters).toEqual([
      { char: 'i', isWrong: false },
      { char: 's', isWrong: false },
      { char: 'n', isWrong: false },
      { char: apostrophe, isWrong: false },
      { char: 'x', isWrong: true },
    ]);
  });

  it.each([
    ['isnt', "isn't"],
    ['arent', "aren't"],
  ])('rejects %s when %s requires an apostrophe', (typedWord, answerWord) => {
    const result = buildSpellingFeedback(typedWord, answerWord);

    expect(result.isCorrect).toBe(false);
    expect(result.typedLetters.some((letter) => letter.isWrong)).toBe(true);
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
