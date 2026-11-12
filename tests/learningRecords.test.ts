import { describe, expect, it } from 'vitest';
import { dailyLearningQuestions } from '../src/data/dailyLearningQuestions';
import { ensureLearningRecords, getLearningRecords, recordCompletedTraining } from '../src/lib/learningRecords';
import { selectReviewQuestions } from '../src/lib/reviewSelection';
import { migrateQuestionIds } from '../src/lib/questionIdMigration';
import { parseAppState } from '../src/schema/studySchema';
import type { AppState, CompletedTrainingInput, Question, TrainingAnswer } from '../src/types/schema';

const START = '2026-11-12T10:00:00+08:00';
const END = '2026-11-12T10:10:00+08:00';

function state(overrides: Partial<AppState> = {}): AppState {
  return { activeSession: null, sessions: [], wrongBook: [], dictationHistory: [], reviewTasks: [], starRecords: [], localAudioFiles: {}, ...overrides };
}

function answer(questionId: number, kind: TrainingAnswer['kind'] = 'practice', isCorrect = true): TrainingAnswer {
  return { questionId, kind, isCorrect, answeredAt: '2026-11-12T10:05:00+08:00' };
}

function training(overrides: Partial<CompletedTrainingInput> = {}): CompletedTrainingInput {
  return { id: 'round', source: 'practice', title: '练习', train: 'weekly', mode: 'vocab', startedAt: START, finishedAt: END, questionTotal: 1, answers: [answer(1)], ...overrides };
}

function question(id: number): Question {
  return { id, level: 'L2', unit: 1, type: 'single_choice', prompt: `word-${id}`, stem: '选择', options: ['一'], answerIndex: 0, explanation: '一', tags: ['vocab'] };
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

describe('persistent learning records', () => {
  it('records all-correct dictation as learned words, updates due tasks and awards one star', () => {
    const answers = dailyLearningQuestions.flatMap((item) => [answer(item.id, 'meaning'), answer(item.id, 'spelling')]);
    const original = state({ reviewTasks: [
      { id: 'due', questionIds: [dailyLearningQuestions[0].id], dueAt: '2026-11-12T09:00:00+08:00', completed: false },
      { id: 'future', questionIds: [dailyLearningQuestions[1].id], dueAt: '2026-11-12T19:00:00+08:00', completed: false },
    ] });
    const completed = recordCompletedTraining(original, training({ source: 'dictation', train: 'dictation', questionTotal: 34, answers }));
    const records = getLearningRecords(completed);

    expect(records.questions).toHaveLength(17);
    expect(records.questions.every((item) => item.correctCount === 2 && item.correctRounds.length === 1)).toBe(true);
    expect(records.rounds[0]).toMatchObject({ source: 'dictation', answeredCount: 34, correctCount: 34, questionTotal: 34, totalsKnown: true, durationSeconds: 600 });
    expect(records.rounds[0].questionIds).toHaveLength(17);
    expect(selectReviewQuestions(dailyLearningQuestions, completed, { kind: 'weekly', now: new Date(END) })).toHaveLength(10);
    expect(completed.reviewTasks[0].completed).toBe(true);
    expect(completed.reviewTasks[1]).toEqual(original.reviewTasks[1]);
    expect(completed.starRecords).toHaveLength(1);
    expect(recordCompletedTraining(completed, training({ source: 'dictation', train: 'dictation', questionTotal: 34, answers }))).toBe(completed);
  });

  it('requires both meaning and spelling to be correct before counting a correct dictation word', () => {
    const original = state({
      wrongBook: [{ questionId: 1, wrongCount: 3, lastWrongAt: START, mastered: false }],
      reviewTasks: [{ id: 'due', questionIds: [1, 2], dueAt: '2026-11-12T09:00:00+08:00', completed: false }],
    });
    const completed = recordCompletedTraining(original, training({ source: 'dictation', questionTotal: 4, answers: [
      answer(1, 'meaning', false), answer(1, 'spelling'), answer(2, 'meaning'), answer(2, 'spelling'),
    ] }));
    expect(completed.reviewTasks[0]).toMatchObject({ completed: false, completedQuestionIds: [2] });
    expect(getLearningRecords(completed).questions.find((item) => item.questionId === 1)).toMatchObject({ correctCount: 1, wrongCount: 1, correctRounds: [] });
    expect(completed.wrongBook).toBe(original.wrongBook);
    expect(completed.starRecords).toHaveLength(0);
  });

  it('does not count a missing dictation part as a successful word', () => {
    const original = state({ reviewTasks: [{ id: 'due', questionIds: [1], dueAt: '2026-11-12T09:00:00+08:00', completed: false }] });
    const completed = recordCompletedTraining(original, training({ source: 'dictation', questionTotal: 2, answers: [answer(1, 'meaning')] }));
    expect(completed.reviewTasks).toBe(original.reviewTasks);
    expect(getLearningRecords(completed).questions[0].correctRounds).toEqual([]);
  });

  it('does not apply a composite correct result when one assessed part happened before the task was due', () => {
    const original = state({ reviewTasks: [{ id: 'due', questionIds: [1], dueAt: '2026-11-12T10:04:00+08:00', completed: false }] });
    const completed = recordCompletedTraining(original, training({ source: 'dictation', questionTotal: 2, answers: [
      { ...answer(1, 'meaning'), answeredAt: '2026-11-12T10:03:00+08:00' }, answer(1, 'spelling'),
    ] }));
    expect(completed.reviewTasks).toBe(original.reviewTasks);
  });

  it('keeps learned eligibility after more than thirty later sessions without saving raw attempts forever', () => {
    let completed = recordCompletedTraining(state(), training({ id: 'original', answers: [answer(1)] }));
    for (let index = 0; index < 35; index += 1) {
      completed = recordCompletedTraining({ ...completed, sessions: [] }, training({ id: `later-${index}`, answers: [answer(2)] }));
    }
    const records = getLearningRecords(completed);
    expect(records.rounds).toHaveLength(36);
    expect(records.rounds.every((round) => !('answers' in round))).toBe(true);
    expect(records.questions).toHaveLength(2);
    expect(selectReviewQuestions([question(1)], completed, { kind: 'weekly', now: new Date(END) })).toHaveLength(1);
    expect(records.questions.find((item) => item.questionId === 2)?.correctRounds).toHaveLength(3);
  });

  it('bounds per-question recent errors while preserving cumulative attempts and light round summaries', () => {
    let completed = state();
    for (let index = 0; index < 20; index += 1) {
      const startedAt = new Date(new Date(START).getTime() + index * 86_400_000).toISOString();
      const finishedAt = new Date(new Date(END).getTime() + index * 86_400_000).toISOString();
      completed = recordCompletedTraining(completed, training({ id: `day-${index}`, startedAt, finishedAt,
        answers: [{ ...answer(1, 'practice', false), answeredAt: finishedAt }],
      }));
    }
    const record = getLearningRecords(completed).questions[0];
    expect(record.answeredCount).toBe(20);
    expect(record.wrongCount).toBe(20);
    expect(record.recentErrors).toHaveLength(7);
    expect(getLearningRecords(completed).rounds).toHaveLength(20);
  });

  it('caps independent correct-round evidence and does not count another attempt from the error round as recovery', () => {
    let completed = recordCompletedTraining(state(), training({ id: 'error', answers: [answer(1, 'practice', false)] }));
    completed = recordCompletedTraining(completed, training({ id: 'same-time', answers: [answer(1)] }));
    expect(getLearningRecords(completed).questions[0].correctRounds).toEqual([]);
    for (let index = 0; index < 5; index += 1) {
      completed = recordCompletedTraining(completed, training({ id: `correct-${index}`, startedAt: '2026-11-12T10:06:00+08:00', answers: [{ ...answer(1), answeredAt: END }] }));
    }
    expect(getLearningRecords(completed).questions[0].correctRounds).toHaveLength(3);
  });

  it('does not double-count a new practice round already added to the recent result list by its caller', () => {
    const rawSession = { id: 'round', startedAt: START, finishedAt: END, currentQuestionIndex: 0, score: 1, accuracy: 1, questionTotal: 1,
      answers: [{ questionId: 1, isCorrect: true, answeredAt: END, selectedIndex: 0 }] };
    const completed = recordCompletedTraining(state({ sessions: [rawSession] }), training());
    expect(getLearningRecords(completed).rounds).toHaveLength(1);
    expect(getLearningRecords(completed).questions[0].answeredCount).toBe(1);
    expect(completed.starRecords).toHaveLength(1);
  });

  it('backfills only known legacy results and never invents correct word IDs or unknown duration', () => {
    const original = state({
      sessions: [{ id: 'old-practice', startedAt: START, finishedAt: END, train: 'daily20', mode: 'vocab', currentQuestionIndex: 0, score: 1, accuracy: 1,
        answers: [{ questionId: 3, selectedIndex: 0, isCorrect: true, answeredAt: END }] }],
      wrongBook: [{ questionId: 4, wrongCount: 20, lastWrongAt: END, mastered: false }],
      dictationHistory: [{ id: 'old-dictation', finishedAt: END, wrongWords: [{ word: 'word-2', meaning: '二', meaningWrongCount: 1, spellingWrongCount: 1 }] }],
      starRecords: [{ id: 'old-perfect', sourceType: 'dictation', sourceId: 'perfect-no-word-list', earnedAt: END, title: '历史满分', score: 30, total: 30 }],
    });
    const hydrated = ensureLearningRecords(original, [question(2), question(3), question(4)]);
    const records = getLearningRecords(hydrated);
    expect(records.questions.map((item) => item.questionId).sort()).toEqual([2, 3, 4]);
    expect(records.questions.find((item) => item.questionId === 4)).toMatchObject({ answeredCount: 0, correctCount: 0, wrongCount: 0 });
    expect(records.rounds.find((item) => item.id === 'old-dictation')).toMatchObject({ answeredCount: 2, totalsKnown: false, questionIds: [2] });
    expect(records.rounds.find((item) => item.id === 'old-dictation')?.correctCount).toBeUndefined();
    expect(records.rounds.find((item) => item.id === 'perfect-no-word-list')).toMatchObject({ correctCount: 30, questionTotal: 30, totalsKnown: true, questionIds: [] });
    expect(records.rounds.find((item) => item.id === 'perfect-no-word-list')?.durationSeconds).toBeUndefined();
    expect(ensureLearningRecords(hydrated)).toBe(hydrated);
    expect(original.learningRecords).toBeUndefined();
  });

  it('survives storage parsing and alias merges without losing question history or duplicating rounds', () => {
    const first = recordCompletedTraining(state(), training({ id: 'old', answers: [answer(19, 'practice', false)] }));
    const completed = recordCompletedTraining(first, training({ id: 'new', answers: [answer(9102)] }));
    const parsed = parseAppState(JSON.parse(JSON.stringify(completed)), state());
    const migrated = migrateQuestionIds(parsed, new Map([[19, 9102]]));
    expect(getLearningRecords(migrated).questions).toHaveLength(1);
    expect(getLearningRecords(migrated).questions[0]).toMatchObject({ questionId: 9102, answeredCount: 2, correctCount: 1, wrongCount: 1 });
    expect(getLearningRecords(migrated).rounds.every((round) => round.questionIds[0] === 9102)).toBe(true);
    expect(migrateQuestionIds(migrated, new Map([[19, 9102]]))).toBe(migrated);
  });

  it('retains correct evidence and error bonuses after raw session history is removed without replaying it twice', () => {
    const original = state({ wrongBook: [
      { questionId: 1, wrongCount: 5, lastWrongAt: '2026-11-11T10:00:00+08:00', mastered: false },
      { questionId: 2, wrongCount: 4, lastWrongAt: '2026-11-11T10:00:00+08:00', mastered: false },
    ] });
    const recovered = recordCompletedTraining(original, training({ answers: [answer(1)] }));
    expect(selectReviewQuestions([question(1), question(2)], { ...recovered, sessions: [] }, {
      kind: 'weekly', count: 1, now: new Date(END),
    })[0].id).toBe(2);

    const errorInput = training({ id: 'error', answers: [answer(2, 'practice', false)] });
    const rawSession = { id: 'error', startedAt: START, finishedAt: END, currentQuestionIndex: 0, score: 0, accuracy: 0, questionTotal: 1,
      answers: [{ questionId: 2, selectedIndex: 0, isCorrect: false, answeredAt: errorInput.answers[0].answeredAt }] };
    const errors = recordCompletedTraining(state({ sessions: [rawSession], activeSession: rawSession, wrongBook: [
      { questionId: 1, wrongCount: 4, lastWrongAt: START, mastered: false },
      { questionId: 2, wrongCount: 1, lastWrongAt: START, mastered: false },
    ] }), errorInput);
    expect(selectReviewQuestions([question(1), question(2)], errors, { kind: 'weekly', count: 1, now: new Date(END) })[0].id).toBe(1);
  });

  it('is idempotent and does not mutate deeply frozen inputs', () => {
    const original = freeze(state());
    const input = freeze(training());
    const snapshot = structuredClone({ original, input });
    const completed = recordCompletedTraining(original, input);
    expect({ original, input }).toEqual(snapshot);
    expect(recordCompletedTraining(completed, input)).toBe(completed);
    expect(completed.learningRecords?.rounds[0]).toMatchObject({ train: 'weekly', mode: 'vocab' });
  });

  it('rejects invalid answer times and source-kind mismatches instead of recording a fake completion', () => {
    expect(() => recordCompletedTraining(state(), training({ answers: [{ ...answer(1), answeredAt: 'invalid' }] }))).toThrow('invalid answer');
    expect(() => recordCompletedTraining(state(), training({ answers: [{ ...answer(1), answeredAt: '2026-11-12T09:59:00+08:00' }] }))).toThrow('invalid answer');
    expect(() => recordCompletedTraining(state(), training({ source: 'dictation' }))).toThrow('invalid answer');
  });
});
