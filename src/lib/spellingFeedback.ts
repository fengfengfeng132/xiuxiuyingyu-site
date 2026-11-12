export interface SpellingLetterFeedback {
  char: string;
  isWrong: boolean;
}

export interface SpellingFeedback {
  isCorrect: boolean;
  typedLetters: SpellingLetterFeedback[];
}

const MISSING_LETTER = '＿';

function normalizeSpelling(value: string): string {
  return value.toLowerCase().replace(/[‘’]/g, "'");
}

// Align the typed word with the answer first, so one missing or extra letter does not mark every later letter as wrong.
function alignTypedLetters(typedChars: string[], answerChars: string[]): SpellingLetterFeedback[] {
  const typed = typedChars.map(normalizeSpelling);
  const answer = answerChars.map(normalizeSpelling);
  const mismatch = (row: number, col: number) => (typed[row] === answer[col] ? 0 : 1);
  // cost[row][col]: fewest single-letter edits that turn typed[row..] into answer[col..].
  const cost = Array.from({ length: typed.length + 1 }, (_, row) =>
    Array.from({ length: answer.length + 1 }, (_, col) => (
      row === typed.length ? answer.length - col : col === answer.length ? typed.length - row : 0
    )));

  for (let row = typed.length - 1; row >= 0; row -= 1) {
    for (let col = answer.length - 1; col >= 0; col -= 1) {
      cost[row][col] = Math.min(
        cost[row + 1][col + 1] + mismatch(row, col),
        cost[row + 1][col] + 1,
        cost[row][col + 1] + 1,
      );
    }
  }

  // Walk from the first letter: keep what was typed in place and add a gap only where a letter is really missing.
  const letters: SpellingLetterFeedback[] = [];
  let row = 0;
  let col = 0;
  while (row < typed.length || col < answer.length) {
    if (row < typed.length && col < answer.length && cost[row][col] === cost[row + 1][col + 1] + mismatch(row, col)) {
      letters.push({ char: typedChars[row], isWrong: mismatch(row, col) === 1 });
      row += 1;
      col += 1;
    } else if (row < typed.length && cost[row][col] === cost[row + 1][col] + 1) {
      letters.push({ char: typedChars[row], isWrong: true });
      row += 1;
    } else {
      letters.push({ char: MISSING_LETTER, isWrong: true });
      col += 1;
    }
  }

  return letters;
}

export function buildSpellingFeedback(userInput: string, correctWord: string): SpellingFeedback {
  const typedWord = userInput.trim();
  const answerWord = correctWord.trim();

  return {
    isCorrect: normalizeSpelling(typedWord) === normalizeSpelling(answerWord),
    typedLetters: alignTypedLetters(Array.from(typedWord), Array.from(answerWord)),
  };
}
