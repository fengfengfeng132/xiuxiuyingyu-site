import { describe, expect, it } from 'vitest';
import { applyReviewAnswers, getPendingReviewQuestionIds } from '../src/lib/reviewProgress';
import type { ReviewTask, SessionAnswer } from '../src/types/schema';

const now = new Date('2026-11-12T12:00:00+08:00');

function task(overrides: Partial<ReviewTask> = {}): ReviewTask {
  return { id: 'review', questionIds: [1, 2, 3], dueAt: '2026-11-11T19:00:00+08:00', completed: false, ...overrides };
}

function answer(questionId: number, isCorrect: boolean, answeredAt = '2026-11-12T11:00:00+08:00'): SessionAnswer {
  return { questionId, selectedIndex: 0, isCorrect, answeredAt };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe('review progress from actual answers', () => {
  it('records only correctly answered task IDs and retains unfinished IDs', () => {
    const tasks = [task()];
    const updated = applyReviewAnswers(tasks, [answer(1, true), answer(2, false), answer(99, true)], now);

    expect(updated[0]).toEqual({ ...tasks[0], completedQuestionIds: [1] });
    expect(getPendingReviewQuestionIds(updated[0])).toEqual([2, 3]);
  });

  it('retains prior correct progress across rounds and completes only after every task ID is correct', () => {
    const tasks = [task({ completedQuestionIds: [1] })];
    const partial = applyReviewAnswers(tasks, [answer(2, true)], now);
    expect(partial[0].completed).toBe(false);
    expect(partial[0].completedQuestionIds).toEqual([1, 2]);

    const finished = applyReviewAnswers(partial, [answer(3, true)], now);
    expect(finished[0].completed).toBe(true);
    expect(getPendingReviewQuestionIds(finished[0])).toEqual([]);
  });

  it('removes previously correct progress when the latest eligible answer is wrong', () => {
    const tasks = [task({ completedQuestionIds: [1, 2] })];
    const updated = applyReviewAnswers(tasks, [answer(1, false)], now);
    expect(updated[0]).toEqual({ ...tasks[0], completedQuestionIds: [2] });
  });

  it('uses answer time rather than array order when selecting the latest answer for each ID', () => {
    const updated = applyReviewAnswers([task()], [
      answer(1, false, '2026-11-12T11:30:00+08:00'),
      answer(1, true, '2026-11-12T10:00:00+08:00'),
      answer(2, false, '2026-11-12T09:00:00+08:00'),
      answer(2, true, '2026-11-12T11:00:00+08:00'),
    ], now);
    expect(updated[0].completedQuestionIds).toEqual([2]);
  });

  it('does not apply morning answers to a task that becomes due at 19:00 that day', () => {
    const tasks = [task({ dueAt: '2026-11-12T19:00:00+08:00' })];
    expect(applyReviewAnswers(tasks, [answer(1, true)], now)).toBe(tasks);
    expect(applyReviewAnswers(tasks, [answer(1, true)], new Date('2026-11-12T20:00:00+08:00'))).toBe(tasks);
  });

  it('ignores answers before a task is due and answers that are still in the future', () => {
    const tasks = [task()];
    expect(applyReviewAnswers(tasks, [
      answer(1, true, '2026-11-11T18:59:59+08:00'),
      answer(2, true, '2026-11-12T12:00:01+08:00'),
    ], now)).toBe(tasks);
  });

  it('accepts answers at the exact due and now boundaries', () => {
    const updated = applyReviewAnswers([task({ questionIds: [1, 2] })], [
      answer(1, true, '2026-11-11T19:00:00+08:00'),
      answer(2, true, now.toISOString()),
    ], now);
    expect(updated[0].completed).toBe(true);
  });

  it('never changes completed, invalid-date, invalid-progress or empty tasks', () => {
    const tasks = [
      task({ id: 'completed', completed: true }),
      task({ id: 'bad-date', dueAt: 'invalid' }),
      task({ id: 'bad-progress', completedQuestionIds: [99] }),
      task({ id: 'empty', questionIds: [] }),
    ];
    expect(applyReviewAnswers(tasks, [answer(1, true)], now)).toBe(tasks);
  });

  it('returns unchanged references for empty or inapplicable answers and invalid dates', () => {
    const tasks = [task({ completedQuestionIds: [1] })];
    expect(applyReviewAnswers(tasks, [], now)).toBe(tasks);
    expect(applyReviewAnswers(tasks, [answer(99, true)], now)).toBe(tasks);
    expect(applyReviewAnswers(tasks, [answer(1, true)], now)).toBe(tasks);
    expect(applyReviewAnswers(tasks, [answer(2, true, 'invalid')], now)).toBe(tasks);
    expect(applyReviewAnswers(tasks, [answer(2, true)], new Date('invalid'))).toBe(tasks);
  });

  it('is idempotent and never mutates tasks, progress or supplied answers', () => {
    const tasks = deepFreeze([task({ completedQuestionIds: [1] }), task({ id: 'unrelated', questionIds: [9] })]);
    const answers = deepFreeze([answer(2, true)]);
    const before = structuredClone({ tasks, answers });
    const updated = applyReviewAnswers(tasks, answers, now);

    expect({ tasks, answers }).toEqual(before);
    expect(updated[1]).toBe(tasks[1]);
    expect(applyReviewAnswers(updated, answers, now)).toBe(updated);
  });

  it('returns distinct pending IDs in task order and excludes partial progress', () => {
    const value = task({ questionIds: [3, 1, 3, 2], completedQuestionIds: [1] });
    const pending = getPendingReviewQuestionIds(value);
    expect(pending).toEqual([3, 2]);
    pending.push(9);
    expect(value.questionIds).toEqual([3, 1, 3, 2]);
  });
});
