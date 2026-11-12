import { describe, expect, it } from 'vitest';
import { dailyLearningQuestions } from '../src/data/dailyLearningQuestions';
import { finishPracticeRound, isPracticeRoundFullyAnswered } from '../src/lib/practiceRound';
import { createInitialState } from '../src/lib/storage';
import type { AppState, StudySession } from '../src/types/schema';

const questionIds = dailyLearningQuestions.slice(0, 3).map((question) => question.id);
const LAST_ANSWER = new Date('2026-11-13T10:03:05.000Z');
const RESULT_TAP = new Date('2026-11-13T10:04:00.000Z');
const options = { train: 'audio', mode: 'vocab' as const, title: '听力', questionTotal: questionIds.length };

function session(results: boolean[]): StudySession {
  return {
    id: 'round-1', startedAt: '2026-11-13T10:00:00.000Z', mode: 'vocab', train: 'audio',
    currentQuestionIndex: results.length - 1, questionIds, questionTotal: questionIds.length,
    answers: results.map((isCorrect, index) => ({
      questionId: questionIds[index], selectedIndex: 0, isCorrect, answeredAt: `2026-11-13T10:0${index + 1}:00.000Z`,
    })),
    score: results.filter(Boolean).length, accuracy: results.filter(Boolean).length / questionIds.length,
  };
}

function stateWith(activeSession: StudySession, overrides: Partial<AppState> = {}): AppState {
  return { ...createInitialState(), activeSession, ...overrides };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe('fully answered round', () => {
  it('needs a saved answer for every question of the round, in any order', () => {
    expect(isPracticeRoundFullyAnswered(questionIds, session([true, false]))).toBe(false);
    expect(isPracticeRoundFullyAnswered(questionIds, session([true, false, true]))).toBe(true);
    expect(isPracticeRoundFullyAnswered([...questionIds].reverse(), session([true, false, true]))).toBe(true);
    expect(isPracticeRoundFullyAnswered([...questionIds, 424242], session([true, false, true]))).toBe(false);
    expect(isPracticeRoundFullyAnswered([], session([]))).toBe(false);
  });
});

describe('finishing a practice round', () => {
  it('records the round with its last answer and keeps it open so the last card can still be looked at', () => {
    const state = stateWith(session([true, true, true]));
    const recorded = finishPracticeRound(state, state.activeSession!, { ...options, keepActive: true, now: LAST_ANSWER });

    expect(recorded.learningRecords!.rounds).toHaveLength(1);
    expect(recorded.learningRecords!.rounds[0]).toMatchObject({
      id: 'round-1', source: 'practice', train: 'audio', questionTotal: 3, answeredCount: 3, correctCount: 3, durationSeconds: 185,
    });
    expect(recorded.starRecords).toHaveLength(1);
    expect(recorded.activeSession).toMatchObject({ id: 'round-1', finishedAt: LAST_ANSWER.toISOString() });
    expect(recorded.sessions.map((item) => item.id)).toEqual(['round-1']);
  });

  it('adds no second round, star or minute when the result button is tapped afterwards', () => {
    const state = stateWith(session([true, true, true]));
    const recorded = finishPracticeRound(state, state.activeSession!, { ...options, keepActive: true, now: LAST_ANSWER });
    const closed = finishPracticeRound(recorded, recorded.activeSession!, { ...options, keepActive: false, now: RESULT_TAP });

    expect(closed.activeSession).toBeNull();
    expect(closed.learningRecords!.rounds).toHaveLength(1);
    expect(closed.learningRecords!.rounds[0].durationSeconds).toBe(185);
    expect(closed.learningRecords!.questions.map((question) => question.answeredCount)).toEqual([1, 1, 1]);
    expect(closed.starRecords).toHaveLength(1);
    expect(closed.sessions).toHaveLength(1);
    expect(closed.sessions[0].finishedAt).toBe(LAST_ANSWER.toISOString());
  });

  it('gives no star for a round with a mistake and still records it once', () => {
    const state = stateWith(session([true, false, true]));
    const recorded = finishPracticeRound(state, state.activeSession!, { ...options, keepActive: true, now: LAST_ANSWER });
    const closed = finishPracticeRound(recorded, recorded.activeSession!, { ...options, keepActive: false, now: RESULT_TAP });

    expect(closed.learningRecords!.rounds).toHaveLength(1);
    expect(closed.learningRecords!.rounds[0]).toMatchObject({ questionTotal: 3, correctCount: 2 });
    expect(closed.starRecords).toHaveLength(0);
  });

  it('records a partly answered round against its full size when it is closed', () => {
    const state = stateWith(session([true, true]));
    const closed = finishPracticeRound(state, state.activeSession!, { ...options, keepActive: false, now: RESULT_TAP });

    expect(closed.learningRecords!.rounds[0]).toMatchObject({ questionTotal: 3, answeredCount: 2, correctCount: 2 });
    expect(closed.starRecords).toHaveLength(0);
    expect(closed.sessions[0].finishedAt).toBe(RESULT_TAP.toISOString());
  });

  it('counts a due review task once', () => {
    const state = stateWith(session([true, true, true]), {
      reviewTasks: [{ id: 'due', questionIds: [questionIds[0]], completedQuestionIds: [], dueAt: '2026-11-12T11:00:00.000Z', completed: false }],
    });
    const recorded = finishPracticeRound(state, state.activeSession!, { ...options, keepActive: true, now: LAST_ANSWER });
    const closed = finishPracticeRound(recorded, recorded.activeSession!, { ...options, keepActive: false, now: RESULT_TAP });

    expect(recorded.reviewTasks[0]).toMatchObject({ completed: true, completedQuestionIds: [questionIds[0]] });
    expect(closed.reviewTasks).toEqual(recorded.reviewTasks);
  });

  it('does not change the state or session it was given', () => {
    const state = stateWith(session([true, true, true]));
    const snapshot = structuredClone(state);
    deepFreeze(state);

    finishPracticeRound(state, state.activeSession!, { ...options, keepActive: true, now: LAST_ANSWER });
    expect(state).toEqual(snapshot);
  });
});
