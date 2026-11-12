import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState, loadState, saveState } from '../src/lib/storage';
import { isReviewTask, parseReviewTasks } from '../src/schema/reviewSchema';
import { isStudySession, parseAppState } from '../src/schema/studySchema';
import type { AppState, ReviewTask, StudySession } from '../src/types/schema';

const session: StudySession = {
  id: 'round', startedAt: '2026-11-12T10:00:00+08:00', mode: 'vocab', train: 'spaced',
  questionIds: [9002, 9001], reviewTaskId: 'review-task', questionTotal: 2,
  currentQuestionIndex: 1, score: 1, accuracy: 1,
  answers: [{ questionId: 9002, selectedIndex: 1, isCorrect: true, answeredAt: '2026-11-12T10:01:00+08:00' }],
};
const task: ReviewTask = {
  id: 'review-task', questionIds: [9001, 9002], completedQuestionIds: [9002],
  dueAt: '2026-11-11T19:00:00+08:00', completed: false,
};

afterEach(() => vi.unstubAllGlobals());

describe('practice snapshots and partial review persistence', () => {
  it('round-trips the saved question order, task scope and correct child progress through local storage', () => {
    let stored: string | null = null;
    vi.stubGlobal('localStorage', {
      getItem: () => stored,
      setItem: (_key: string, value: string) => { stored = value; },
    });
    const state: AppState = { ...initialState, activeSession: session, sessions: [session], reviewTasks: [task] };
    saveState(state);
    const restored = loadState();

    expect(restored.activeSession).toEqual(session);
    expect(restored.sessions).toEqual([session]);
    expect(restored.reviewTasks).toEqual([task]);
  });

  it('accepts legacy sessions and normalizes old review tasks to empty correct progress', () => {
    const legacySession = { ...session };
    delete legacySession.questionIds;
    delete legacySession.reviewTaskId;
    const legacyTask = { ...task };
    delete legacyTask.completedQuestionIds;
    const restored = parseAppState({ activeSession: legacySession, sessions: [legacySession], reviewTasks: [legacyTask] }, initialState);

    expect(restored.activeSession?.questionIds).toBeUndefined();
    expect(restored.activeSession?.reviewTaskId).toBeUndefined();
    expect(restored.reviewTasks[0].completedQuestionIds).toEqual([]);
    expect(legacyTask).not.toHaveProperty('completedQuestionIds');
  });

  it.each([null, '9001', [NaN], [Infinity], [0], [-1], [1.5], ['9001']])('rejects malformed saved ID arrays: %j', (questionIds) => {
    expect(isStudySession({ ...session, questionIds })).toBe(false);
  });

  it('rejects non-string review task scope identifiers', () => {
    expect(isStudySession({ ...session, reviewTaskId: 123 })).toBe(false);
    expect(isStudySession({ ...session, reviewTaskId: null })).toBe(false);
  });

  it.each([null, '9001', [NaN], [Infinity], [0], [-1], [1.5], ['9001'], [9999]])('rejects malformed or foreign correct progress: %j', (completedQuestionIds) => {
    expect(isReviewTask({ ...task, completedQuestionIds })).toBe(false);
    expect(parseReviewTasks([{ ...task, completedQuestionIds }])).toEqual([]);
  });
});
