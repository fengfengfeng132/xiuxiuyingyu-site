export interface SpellingLetterFeedback {
  char: string;
  isWrong: boolean;
}

export interface SpellingFeedback {
  isCorrect: boolean;
  typedLetters: SpellingLetterFeedback[];
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
      isWrong: typedChar.toLowerCase() !== expectedChar.toLowerCase(),
    };
  });

  return {
    isCorrect: typedWord.toLowerCase() === answerWord.toLowerCase(),
    typedLetters,
  };
}
