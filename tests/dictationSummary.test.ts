import { describe, expect, it } from 'vitest';
import { summarizeWrongDictationAnswers, type DictationAnswerRecord } from '../src/lib/dictationSummary';

function makeAnswer(overrides: Partial<DictationAnswerRecord>): DictationAnswerRecord {
  return {
    stepId: 'step-1',
    type: 'listenChoose',
    word: 'hot',
    meaning: '热的',
    userAnswer: '冷的',
    correctAnswer: '热的',
    isCorrect: false,
    ...overrides,
  };
}

describe('dictationSummary', () => {
  it('groups wrong answers by word and keeps both meaning and spelling mistakes', () => {
    const summary = summarizeWrongDictationAnswers([
      makeAnswer({
        stepId: 'choose-hot',
        type: 'listenChoose',
        word: 'hot',
        meaning: '热的',
        userAnswer: '冷的',
        correctAnswer: '热的',
      }),
      makeAnswer({
        stepId: 'spell-hot',
        type: 'listenSpell',
        word: 'hot',
        meaning: '热的',
        userAnswer: 'hod',
        correctAnswer: 'hot',
      }),
      makeAnswer({
        stepId: 'spell-same',
        type: 'listenSpell',
        word: 'same',
        meaning: '相同的',
        userAnswer: 'sam',
        correctAnswer: 'same',
      }),
    ]);

    expect(summary).toEqual([
      {
        word: 'hot',
        meaning: '热的',
        wrongCount: 2,
        meaningMistakes: [
          {
            userAnswer: '冷的',
            correctAnswer: '热的',
          },
        ],
        spellingMistakes: [
          {
            userAnswer: 'hod',
            correctAnswer: 'hot',
          },
        ],
      },
      {
        word: 'same',
        meaning: '相同的',
        wrongCount: 1,
        meaningMistakes: [],
        spellingMistakes: [
          {
            userAnswer: 'sam',
            correctAnswer: 'same',
          },
        ],
      },
    ]);
  });

  it('ignores correct answers in the completion summary', () => {
    const summary = summarizeWrongDictationAnswers([
      makeAnswer({
        stepId: 'choose-hot',
        type: 'listenChoose',
        isCorrect: true,
        userAnswer: '热的',
        correctAnswer: '热的',
      }),
      makeAnswer({
        stepId: 'spell-hot',
        type: 'listenSpell',
        isCorrect: true,
        userAnswer: 'hot',
        correctAnswer: 'hot',
      }),
    ]);

    expect(summary).toEqual([]);
  });
});
