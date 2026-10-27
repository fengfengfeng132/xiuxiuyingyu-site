export interface SpellingLetterFeedback {
  char: string;
  isWrong: boolean;
}

export interface SpellingFeedback {
  isCorrect: boolean;
  typedLetters: SpellingLetterFeedback[];
}

function normalizeSpelling(value: string): string {
  return value.toLowerCase().replace(/[\u2018\u2019]/g, "'");
}

export function buildSpellingFeedback(userInput: string, correctWord: string): SpellingFeedback {
  const typedWord = userInput.trim();
  const answerWord = correctWord.trim();
  const typedChars = Array.from(typedWord);
  const answerChars = Array.from(answerWord);
  const totalLetters = Math.max(typedChars.length, answerChars.length);

  const typedLetters = Array.from({ length: totalLetters }, (_, index) => {
    const typedChar = typedChars[index] ?? '＿';
    const expectedChar = answerChars[index] ?? '';

    return {
      char: typedChar,
      isWrong: normalizeSpelling(typedChar) !== normalizeSpelling(expectedChar),
    };
  });

  return {
    isCorrect: normalizeSpelling(typedWord) === normalizeSpelling(answerWord),
    typedLetters,
  };
}
