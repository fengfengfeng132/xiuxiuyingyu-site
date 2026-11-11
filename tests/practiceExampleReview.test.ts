import { describe, expect, it } from 'vitest';
import { dailyLearningQuestions } from '../src/data/dailyLearningQuestions';
import { getSavedExampleReview } from '../src/lib/practiceExampleReview';
import type { SessionAnswer } from '../src/types/schema';

const question = dailyLearningQuestions[0];
const savedWrongAnswer: SessionAnswer = {
  questionId: question.id,
  selectedIndex: (question.answerIndex + 1) % question.options.length,
  isCorrect: false,
  answeredAt: '2026-11-11T12:00:00.000Z',
};

describe('saved example review', () => {
  it('restores an answered choice question for locked review without changing its saved result', () => {
    const originalAnswer = { ...savedWrongAnswer };
    const review = getSavedExampleReview(question, savedWrongAnswer);
    expect(review?.questionId).toBe(question.id);
    expect(review?.feedback).toContain(question.options[question.answerIndex]);
    expect(savedWrongAnswer).toEqual(originalAnswer);
    expect(savedWrongAnswer.isCorrect).toBe(false);
  });

  it('does not reconstruct an incorrect spelling that was never persisted', () => {
    const review = getSavedExampleReview(question, { ...savedWrongAnswer, selectedIndex: -1 });
    expect(review?.spellingInput).toBe('');
    expect(review?.feedback).toContain('原来的拼写未保存');
    expect(review?.feedback).toContain(question.prompt);
    expect(review?.questionId).toBe(question.id);
  });

  it('can restore the known correct spelling for an already correct answer', () => {
    const review = getSavedExampleReview(question, { ...savedWrongAnswer, selectedIndex: -1, isCorrect: true });
    expect(review?.spellingInput).toBe(question.prompt);
    expect(review?.feedback).toContain('已经答对');
  });

  it('keeps a new or different question unrevealed', () => {
    expect(getSavedExampleReview(question)).toBeNull();
    expect(getSavedExampleReview(question, { ...savedWrongAnswer, questionId: question.id + 1 })).toBeNull();
  });

  it('keeps the existing behavior of questions without examples', () => {
    expect(getSavedExampleReview({ ...question, examples: undefined }, savedWrongAnswer)).toBeNull();
  });
});
