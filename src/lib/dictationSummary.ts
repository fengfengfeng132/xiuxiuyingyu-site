export interface DictationAnswerRecord {
  stepId: string;
  type: 'listenChoose' | 'listenSpell';
  word: string;
  meaning: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export interface DictationMistakeDetail {
  userAnswer: string;
  correctAnswer: string;
}

export interface DictationWrongWordSummary {
  word: string;
  meaning: string;
  wrongCount: number;
  meaningMistakes: DictationMistakeDetail[];
  spellingMistakes: DictationMistakeDetail[];
}

export function summarizeWrongDictationAnswers(answers: DictationAnswerRecord[]): DictationWrongWordSummary[] {
  const summaryMap = answers.reduce<Map<string, DictationWrongWordSummary>>((acc, answer) => {
    if (answer.isCorrect) return acc;

    const existing = acc.get(answer.word);
    const nextItem = existing ?? {
      word: answer.word,
      meaning: answer.meaning,
      wrongCount: 0,
      meaningMistakes: [],
      spellingMistakes: [],
    };

    nextItem.wrongCount += 1;
    const nextMistake = {
      userAnswer: answer.userAnswer,
      correctAnswer: answer.correctAnswer,
    };

    if (answer.type === 'listenChoose') {
      nextItem.meaningMistakes.push(nextMistake);
    } else {
      nextItem.spellingMistakes.push(nextMistake);
    }

    acc.set(answer.word, nextItem);
    return acc;
  }, new Map());

  return Array.from(summaryMap.values());
}
