import { describe, expect, it } from 'vitest';
import {
  WRONG_ANSWER_TONE_PATTERN,
  collectWrongWordReviewItems,
  updateWrongBookForQuestion,
} from '../src/lib/studyFeedback';
import type { Question, ReviewTask, SessionAnswer, WrongItem } from '../src/types/schema';

function makeQuestion(id: number, prompt: string, explanation: string, tags: string[] = ['vocab']): Question {
  return {
    id,
    level: 'L2',
    unit: 1,
    type: 'single_choice',
    prompt,
    stem: `stem-${prompt}`,
    options: ['A', 'B', 'C', 'D'],
    answerIndex: 0,
    explanation,
    tags,
    audioText: prompt,
  };
}

describe('studyFeedback', () => {
  it('collects wrong review words and merges repeated misses for the same prompt', () => {
    const answers: SessionAnswer[] = [
      { questionId: 9001, selectedIndex: 1, isCorrect: false, answeredAt: '2026-04-17T10:00:00.000Z' },
      { questionId: 9001, selectedIndex: 2, isCorrect: false, answeredAt: '2026-04-17T10:02:00.000Z' },
      { questionId: 9002, selectedIndex: 3, isCorrect: false, answeredAt: '2026-04-17T10:04:00.000Z' },
      { questionId: 77, selectedIndex: 0, isCorrect: true, answeredAt: '2026-04-17T10:05:00.000Z' },
    ];
    const bank: Question[] = [
      makeQuestion(9001, 'laugh', 'laugh 笑', ['vocab', 'daily-dictation']),
      makeQuestion(9002, 'share', 'share 分享', ['vocab']),
    ];

    expect(collectWrongWordReviewItems(answers, bank)).toEqual([
      { questionId: 9001, prompt: 'laugh', meaning: '笑', wrongCount: 2 },
      { questionId: 9002, prompt: 'share', meaning: '分享', wrongCount: 1 },
    ]);
  });

  it('updates wrong book and review tasks without mutating inputs', () => {
    const wrongBook: WrongItem[] = [
      { questionId: 9001, wrongCount: 1, lastWrongAt: '2026-04-15T10:00:00.000Z', mastered: true },
    ];
    const reviewTasks: ReviewTask[] = [
      { id: 'seed', questionIds: [9003], dueAt: '2026-04-18T11:00:00.000Z', completed: false },
    ];

    const result = updateWrongBookForQuestion(wrongBook, reviewTasks, 9001, new Date('2026-04-17T12:00:00+08:00'));

    expect(wrongBook).toEqual([
      { questionId: 9001, wrongCount: 1, lastWrongAt: '2026-04-15T10:00:00.000Z', mastered: true },
    ]);
    expect(reviewTasks).toEqual([
      { id: 'seed', questionIds: [9003], dueAt: '2026-04-18T11:00:00.000Z', completed: false },
    ]);
    expect(result.wrongBook[0]).toMatchObject({
      questionId: 9001,
      wrongCount: 2,
      mastered: false,
    });
    expect(result.reviewTasks.length).toBeGreaterThan(reviewTasks.length);
  });

  it('uses a stable descending tone pattern for wrong-answer feedback', () => {
    expect(WRONG_ANSWER_TONE_PATTERN).toEqual([
      { frequency: 392, durationMs: 120 },
      { frequency: 262, durationMs: 180 },
    ]);
  });
});
