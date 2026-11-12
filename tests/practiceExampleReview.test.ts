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

  it('restores a correct answer without examples when review mode requests it', () => {
    const answeredQuestion = { ...question, examples: undefined };
    const answer = { ...savedWrongAnswer, selectedIndex: question.answerIndex, isCorrect: true };
    const review = getSavedExampleReview(answeredQuestion, answer, true);
    expect(review?.questionId).toBe(question.id);
    expect(review?.feedback).toContain('已经答对');
    expect(review?.feedback).not.toContain('例句');
    expect(answer.isCorrect).toBe(true);
  });

  it('restores an incorrect answer without examples and preserves its original result', () => {
    const answer = { ...savedWrongAnswer };
    const originalAnswer = { ...answer };
    const review = getSavedExampleReview({ ...question, examples: undefined }, answer, true);
    expect(review?.questionId).toBe(question.id);
    expect(review?.feedback).toContain(question.options[question.answerIndex]);
    expect(answer).toEqual(originalAnswer);
    expect(answer.isCorrect).toBe(false);
  });

  it('does not invent an incorrect spelling when restoring review without examples', () => {
    const answer = { ...savedWrongAnswer, selectedIndex: -1 };
    const review = getSavedExampleReview({ ...question, examples: undefined }, answer, true);
    expect(review?.spellingInput).toBe('');
    expect(review?.feedback).toContain('原来的拼写未保存');
    expect(answer.isCorrect).toBe(false);
  });

  it('still requires a saved answer for the same question in review mode', () => {
    const answeredQuestion = { ...question, examples: undefined };
    expect(getSavedExampleReview(answeredQuestion, undefined, true)).toBeNull();
    expect(getSavedExampleReview(answeredQuestion, { ...savedWrongAnswer, questionId: question.id + 1 }, true)).toBeNull();
  });
});
