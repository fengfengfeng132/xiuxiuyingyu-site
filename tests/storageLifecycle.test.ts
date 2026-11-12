import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_STORAGE_KEY, createInitialState, loadState, resetState, saveState } from '../src/lib/storage';
import { updateWrongBookForQuestion } from '../src/lib/studyFeedback';
import { recordCompletedTraining } from '../src/lib/learningRecords';

let memory: Map<string, string>;
beforeEach(() => {
  memory = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key) });
});
afterEach(() => vi.unstubAllGlobals());

describe('local storage lifecycle', () => {
  it('creates independent default containers for every state and empty load', () => {
    const first = createInitialState();
    const second = createInitialState();
    first.wrongBook.push({ questionId: 1, wrongCount: 1, mastered: false, lastWrongAt: '2026-11-12T10:00:00Z' });
    first.learningRecords!.questions.push({ questionId: 1, firstSeenAt: '2026-11-12T10:00:00Z', lastReviewedAt: '2026-11-12T10:00:00Z', answeredCount: 0, correctCount: 0, wrongCount: 0, recentErrors: [], correctRounds: [] });
    expect(second.wrongBook).toEqual([]);
    expect(second.learningRecords?.questions).toEqual([]);
    expect(loadState()).not.toBe(loadState());
    expect(loadState().wrongBook).toEqual([]);
  });

  it('keeps records empty after first-use dictation errors, reset, navigation and later saving', () => {
    const first = loadState();
    const feedback = updateWrongBookForQuestion(first.wrongBook, first.reviewTasks, 9101, new Date('2026-11-12T10:00:00+08:00'));
    first.wrongBook = feedback.wrongBook;
    first.reviewTasks = feedback.reviewTasks;
    saveState(first);
    resetState();

    expect(memory.has(APP_STORAGE_KEY)).toBe(false);
    const empty = loadState();
    expect(empty.wrongBook).toEqual([]);
    expect(empty.reviewTasks).toEqual([]);
    saveState(empty);
    expect(loadState().wrongBook).toEqual([]);
    expect(loadState().reviewTasks).toEqual([]);
  });

  it('returns a fresh empty state after malformed storage without reusing a polluted fallback', () => {
    memory.set(APP_STORAGE_KEY, '{invalid');
    const broken = loadState();
    broken.sessions.push({ id: 'mutated', startedAt: '', currentQuestionIndex: 0, score: 0, accuracy: 0, answers: [] });
    expect(loadState().sessions).toEqual([]);
  });

  it('persists long-term records across storage serialization and reset removes those too', () => {
    const completed = recordCompletedTraining(loadState(), {
      id: 'learned', source: 'practice', title: '练习', startedAt: '2026-11-12T10:00:00+08:00', finishedAt: '2026-11-12T10:10:00+08:00',
      questionTotal: 1, answers: [{ questionId: 1, kind: 'practice', isCorrect: true, answeredAt: '2026-11-12T10:05:00+08:00' }],
    });
    saveState(completed);
    expect(loadState().learningRecords?.questions[0].questionId).toBe(1);
    expect(loadState().learningRecords?.rounds).toHaveLength(1);
    resetState();
    expect(loadState().learningRecords).toEqual({ version: 1, rounds: [], questions: [] });
  });

  it('preserves legacy grades and both attempts when aliases merge formerly distinct question IDs', () => {
    const legacy = { ...createInitialState(), learningRecords: undefined, sessions: [{
      id: 'old-round', startedAt: '2026-11-12T10:00:00+08:00', finishedAt: '2026-11-12T10:10:00+08:00',
      questionTotal: 2, currentQuestionIndex: 1, score: 1, accuracy: 0.5,
      answers: [
        { questionId: 19, selectedIndex: 0, isCorrect: true, answeredAt: '2026-11-12T10:01:00+08:00' },
        { questionId: 9102, selectedIndex: 1, isCorrect: false, answeredAt: '2026-11-12T10:02:00+08:00' },
      ],
    }] };
    memory.set(APP_STORAGE_KEY, JSON.stringify(legacy));
    const loaded = loadState();
    expect(loaded.learningRecords?.rounds[0]).toMatchObject({ questionTotal: 2, answeredCount: 2, correctCount: 1, totalsKnown: true });
    expect(loaded.learningRecords?.questions).toHaveLength(1);
    expect(loaded.learningRecords?.questions[0]).toMatchObject({ questionId: 9102, answeredCount: 2, correctCount: 1, wrongCount: 1, correctRounds: [] });
  });

  it('does not present an unknown legacy question total as a known accuracy denominator', () => {
    const legacy = { ...createInitialState(), learningRecords: undefined, sessions: [{
      id: 'unknown-total', startedAt: '2026-11-12T10:00:00+08:00', finishedAt: '2026-11-12T10:10:00+08:00',
      currentQuestionIndex: 0, score: 1, accuracy: 1,
      answers: [{ questionId: 1, selectedIndex: 0, isCorrect: true, answeredAt: '2026-11-12T10:01:00+08:00' }],
    }] };
    memory.set(APP_STORAGE_KEY, JSON.stringify(legacy));
    const summary = loadState().learningRecords?.rounds[0];
    expect(summary).toMatchObject({ answeredCount: 1, correctCount: 1, totalsKnown: false });
    expect(summary?.questionTotal).toBeUndefined();
  });
});
