import { describe, expect, it } from 'vitest';
import { getLegacyPracticeQuestionIds, getSavedPracticeQuestionIds } from '../src/lib/practiceSession';
import type { Question, StudySession } from '../src/types/schema';

const bank: Question[] = [1, 2, 3].map((id) => ({
  id, level: 'L2', unit: 1, type: 'single_choice', prompt: `word-${id}`, stem: '选择',
  options: ['甲', '乙', '丙', '丁'], answerIndex: 0, explanation: '意思', tags: ['vocab'],
}));
const scope = { mode: 'vocab', train: 'today10' } as const;

function session(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: 'round', startedAt: '2026-11-12T10:00:00+08:00', ...scope, questionIds: [3, 1, 2],
    questionTotal: 3, currentQuestionIndex: 1, score: 1, accuracy: 1,
    answers: [{ questionId: 3, selectedIndex: 0, isCorrect: true, answeredAt: '2026-11-12T10:01:00+08:00' }],
    ...overrides,
  };
}

describe('saved practice question snapshot', () => {
  it('restores the exact saved order after serialization even when bank order changes', () => {
    const saved = JSON.parse(JSON.stringify(session())) as StudySession;
    expect(getSavedPracticeQuestionIds(saved, [...bank].reverse(), scope)).toEqual([3, 1, 2]);
    expect(getSavedPracticeQuestionIds(saved, bank, scope)).toEqual([3, 1, 2]);
  });

  it('returns a copy so caller changes cannot corrupt the saved round', () => {
    const saved = session();
    const restored = getSavedPracticeQuestionIds(saved, bank, scope);
    restored?.reverse();
    expect(saved.questionIds).toEqual([3, 1, 2]);
  });

  it('keeps old sessions without a snapshot available for explicit legacy handling', () => {
    expect(getSavedPracticeQuestionIds(session({ questionIds: undefined }), bank, scope)).toBeNull();
    expect(getSavedPracticeQuestionIds(null, bank, scope)).toBeNull();
  });

  it('does not reuse snapshots from a different mode, training entry or review task', () => {
    expect(getSavedPracticeQuestionIds(session({ mode: 'all' }), bank, scope)).toBeNull();
    expect(getSavedPracticeQuestionIds(session({ train: 'daily20' }), bank, scope)).toBeNull();
    expect(getSavedPracticeQuestionIds(session({ reviewTaskId: 'task-a' }), bank, scope)).toBeNull();
    expect(getSavedPracticeQuestionIds(session({ reviewTaskId: 'task-a' }), bank, { ...scope, reviewTaskId: 'task-b' })).toBeNull();
    expect(getSavedPracticeQuestionIds(session({ reviewTaskId: 'task-a' }), bank, { ...scope, reviewTaskId: 'task-a' })).toEqual([3, 1, 2]);
  });

  it('rejects snapshots containing removed questions or answers outside their round', () => {
    expect(getSavedPracticeQuestionIds(session({ questionIds: [3, 4] }), bank, scope)).toBeNull();
    expect(getSavedPracticeQuestionIds(session({ questionIds: [1, 2] }), bank, scope)).toBeNull();
  });

  it('rejects empty, duplicate and invalid ID snapshots', () => {
    for (const questionIds of [[], [3, 3], [3, NaN], [3, -1], [3, 1.5]]) {
      expect(getSavedPracticeQuestionIds(session({ questionIds }), bank, scope)).toBeNull();
    }
  });
});

describe('legacy practice question recovery', () => {
  it('moves the answered question from bank position five into a fixed prefix without skipping any unanswered question', () => {
    const reorderedBank = [1, 2, 4, 5, 3].map((id) => ({ ...bank[0], id }));
    const saved = session({ questionIds: undefined, currentQuestionIndex: 1 });
    const restored = getLegacyPracticeQuestionIds(saved, reorderedBank, scope);

    expect(restored).toEqual([3, 1, 2, 4, 5]);
    const answeredPrefixLength = new Set(saved.answers.map((answer) => answer.questionId)).size;
    expect(restored?.slice(answeredPrefixLength)).toEqual([1, 2, 4, 5]);
    expect(saved.currentQuestionIndex).toBe(1);
    expect(reorderedBank.map((question) => question.id)).toEqual([1, 2, 4, 5, 3]);
  });

  it('deduplicates answers in their original order and ignores the obsolete stored index', () => {
    const saved = session({ questionIds: undefined, currentQuestionIndex: 99 });
    saved.answers = [saved.answers[0], { ...saved.answers[0], questionId: 2 }, saved.answers[0]];
    expect(getLegacyPracticeQuestionIds(saved, bank, scope)).toEqual([3, 2, 1]);
  });

  it('refuses existing snapshots even when they are invalid rather than treating them as legacy', () => {
    expect(getLegacyPracticeQuestionIds(session(), bank, scope)).toBeNull();
    expect(getLegacyPracticeQuestionIds(session({ questionIds: [99] }), bank, scope)).toBeNull();
    expect(getLegacyPracticeQuestionIds(session({ questionIds: [] }), bank, scope)).toBeNull();
  });

  it('requires the same mode, entry and task scope with all answers still in the current bank', () => {
    const legacy = session({ questionIds: undefined });
    expect(getLegacyPracticeQuestionIds(null, bank, scope)).toBeNull();
    expect(getLegacyPracticeQuestionIds({ ...legacy, mode: 'all' }, bank, scope)).toBeNull();
    expect(getLegacyPracticeQuestionIds({ ...legacy, train: 'daily20' }, bank, scope)).toBeNull();
    expect(getLegacyPracticeQuestionIds({ ...legacy, reviewTaskId: 'old-task' }, bank, scope)).toBeNull();
    expect(getLegacyPracticeQuestionIds(legacy, bank.slice(0, 2), scope)).toBeNull();
  });
});
