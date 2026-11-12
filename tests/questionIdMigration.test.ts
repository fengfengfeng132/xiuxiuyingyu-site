import { afterEach, describe, expect, it, vi } from 'vitest';
import { questionBank, questionIdAliases } from '../src/data/loadQuestionBank';
import { migrateQuestionIds } from '../src/lib/questionIdMigration';
import { APP_STORAGE_KEY, loadState } from '../src/lib/storage';
import type { AppState, StudySession } from '../src/types/schema';

function makeSession(questionIds: number[]): StudySession {
  return {
    id: 'previous-session',
    startedAt: '2026-11-10T10:00:00.000Z',
    finishedAt: '2026-11-10T10:10:00.000Z',
    mode: 'vocab',
    train: 'normal',
    currentQuestionIndex: 3,
    questionTotal: questionIds.length,
    answers: questionIds.map((questionId, index) => ({
      questionId,
      selectedIndex: index % 4,
      isCorrect: index % 2 === 0,
      answeredAt: `2026-11-10T10:0${index}:00.000Z`,
    })),
    score: 2,
    accuracy: 0.5,
  };
}

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    activeSession: null,
    sessions: [],
    wrongBook: [],
    dictationHistory: [],
    reviewTasks: [],
    starRecords: [],
    localAudioFiles: { recordedStory: 'local-audio-blob' },
    ...overrides,
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

afterEach(() => vi.unstubAllGlobals());

describe('question ID migration', () => {
  it('derives old base-question aliases that resolve to the same words in the current bank', () => {
    expect(questionIdAliases.get(19)).toBe(9102);
    expect(questionIdAliases.get(73)).toBe(9101);
    expect(questionBank.find((question) => question.id === questionIdAliases.get(19))?.prompt).toBe('clean');
    expect(questionBank.find((question) => question.id === questionIdAliases.get(73))?.prompt).toBe('baby');
    expect(questionIdAliases.has(9001)).toBe(false);
    expect(questionBank.find((question) => question.id === 9001)?.prompt).toBe('am');
  });

  it('merges old and replacement wrong-word records without dropping mistakes or unmastered status', () => {
    const state = makeState({
      wrongBook: [
        { questionId: 19, wrongCount: 2, lastWrongAt: '2026-11-10T20:00:00+08:00', mastered: true },
        { questionId: 9102, wrongCount: 3, lastWrongAt: '2026-11-10T14:00:00.000Z', mastered: false },
        { questionId: 9001, wrongCount: 1, lastWrongAt: '2026-11-09T10:00:00.000Z', mastered: true },
      ],
      reviewTasks: [{ id: 'review', questionIds: [19, 9102, 73, 9001], dueAt: '2026-11-11T11:00:00.000Z', completed: false }],
    });

    const migrated = migrateQuestionIds(state, questionIdAliases);

    expect(migrated.wrongBook).toEqual([
      { questionId: 9102, wrongCount: 5, lastWrongAt: '2026-11-10T14:00:00.000Z', mastered: false },
      state.wrongBook[2],
    ]);
    expect(migrated.reviewTasks[0]).toEqual({ ...state.reviewTasks[0], questionIds: [9102, 9101, 9001] });
  });

  it('changes session references while preserving historical answers, scores and completion state', () => {
    const session = makeSession([19, 9102, 73, 9001]);
    const state = makeState({ activeSession: { ...session, finishedAt: undefined }, sessions: [session] });
    const migrated = migrateQuestionIds(state, questionIdAliases);
    const expectedAnswers = session.answers.map((answer, index) => ({ ...answer, questionId: [9102, 9102, 9101, 9001][index] }));

    expect(migrated.sessions[0]).toEqual({ ...session, answers: expectedAnswers });
    expect(migrated.activeSession).toEqual({ ...state.activeSession, answers: expectedAnswers });
    expect(migrated.localAudioFiles).toBe(state.localAudioFiles);
  });

  it('is idempotent and leaves the complete input tree unchanged', () => {
    const state = makeState({
      activeSession: makeSession([19, 73]),
      sessions: [makeSession([19, 73])],
      wrongBook: [{ questionId: 19, wrongCount: 2, lastWrongAt: '2026-11-10T10:00:00.000Z', mastered: false }],
      reviewTasks: [{ id: 'review', questionIds: [19, 73], dueAt: '2026-11-11T11:00:00.000Z', completed: false }],
    });
    const snapshot = structuredClone(state);
    deepFreeze(state);

    const migrated = migrateQuestionIds(state, questionIdAliases);

    expect(state).toEqual(snapshot);
    expect(migrateQuestionIds(migrated, questionIdAliases)).toBe(migrated);
    expect(migrateQuestionIds(state, new Map())).toBe(state);
  });

  it('migrates persisted references at the storage loading boundary', () => {
    const state = makeState({
      wrongBook: [{ questionId: 19, wrongCount: 1, lastWrongAt: '2026-11-10T10:00:00.000Z', mastered: false }],
      sessions: [makeSession([19, 73])],
    });
    const getItem = vi.fn(() => JSON.stringify(state));
    vi.stubGlobal('localStorage', { getItem });

    const loaded = loadState();

    expect(getItem).toHaveBeenCalledWith(APP_STORAGE_KEY);
    expect(loaded.wrongBook[0].questionId).toBe(9102);
    expect(loaded.sessions[0].answers.map((answer) => answer.questionId)).toEqual([9102, 9101]);
  });

  it('migrates and deduplicates round snapshots and correct review progress without changing scores or task state', () => {
    const session = { ...makeSession([19, 73]), questionIds: [19, 9102, 73, 9001], reviewTaskId: 'review' };
    const state = makeState({
      activeSession: session,
      sessions: [session],
      reviewTasks: [{
        id: 'review', questionIds: [19, 9102, 73, 9001], completedQuestionIds: [19, 9102, 73],
        dueAt: '2026-11-11T11:00:00.000Z', completed: false,
      }],
    });
    const snapshot = structuredClone(state);
    deepFreeze(state);
    const migrated = migrateQuestionIds(state, questionIdAliases);

    expect(migrated.activeSession?.questionIds).toEqual([9102, 9101, 9001]);
    expect(migrated.sessions[0].questionIds).toEqual([9102, 9101, 9001]);
    expect(migrated.sessions[0].score).toBe(session.score);
    expect(migrated.sessions[0].questionTotal).toBe(session.questionTotal);
    expect(migrated.sessions[0].reviewTaskId).toBe('review');
    expect(migrated.reviewTasks[0]).toEqual({
      ...state.reviewTasks[0], questionIds: [9102, 9101, 9001], completedQuestionIds: [9102, 9101],
    });
    expect(state).toEqual(snapshot);
    expect(migrateQuestionIds(migrated, questionIdAliases)).toBe(migrated);
  });

  it('marks a task complete when alias merging leaves every distinct question already correct', () => {
    const state = makeState({
      reviewTasks: [{
        id: 'collision', questionIds: [19, 9102], completedQuestionIds: [19],
        dueAt: '2026-11-11T11:00:00.000Z', completed: false,
      }, {
        id: 'legacy-complete', questionIds: [73], dueAt: '2026-11-11T11:00:00.000Z', completed: true,
      }],
    });
    const snapshot = structuredClone(state);
    deepFreeze(state);
    const migrated = migrateQuestionIds(state, questionIdAliases);

    expect(migrated.reviewTasks[0]).toEqual({
      ...state.reviewTasks[0], questionIds: [9102], completedQuestionIds: [9102], completed: true,
    });
    expect(migrated.reviewTasks[1]).toEqual({ ...state.reviewTasks[1], questionIds: [9101] });
    expect(state).toEqual(snapshot);
    expect(migrateQuestionIds(migrated, questionIdAliases)).toBe(migrated);
  });
});
