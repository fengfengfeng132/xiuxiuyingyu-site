import { describe, expect, it } from 'vitest';
import { pickLeastRecentlyReviewed, selectReviewQuestions, type ReviewKind } from '../src/lib/reviewSelection';
import type { LearningRecords, Question, QuestionLearningRecord, ReviewTask, StudySession, WrongItem } from '../src/types/schema';

type ReviewState = Parameters<typeof selectReviewQuestions>[1];
const NOW = new Date('2026-11-12T12:00:00+08:00');

function question(id: number, archived = true): Question {
  return {
    id, level: 'L2', unit: 1, type: 'single_choice', prompt: `word-${id}`,
    stem: '选出意思', options: ['一', '二', '三', '四'], answerIndex: 0,
    explanation: `word-${id} 一`, tags: archived ? ['vocab', 'archived-dictation'] : ['vocab'],
  };
}

function bank(size: number, archived = true): Question[] {
  return Array.from({ length: size }, (_, index) => question(index + 1, archived));
}

function wrong(questionId: number, overrides: Partial<WrongItem> = {}): WrongItem {
  return { questionId, wrongCount: 1, lastWrongAt: '2026-11-11T10:00:00+08:00', mastered: false, ...overrides };
}

function task(questionIds: number[], overrides: Partial<ReviewTask> = {}): ReviewTask {
  return { id: 'review', questionIds, dueAt: '2026-11-12T09:00:00+08:00', completed: false, ...overrides };
}

function session(id: string, questionId: number, isCorrect: boolean, startedAt = '2026-11-12T09:00:00+08:00'): StudySession {
  return {
    id, startedAt, currentQuestionIndex: 0, score: isCorrect ? 1 : 0, accuracy: isCorrect ? 1 : 0,
    answers: [{ questionId, selectedIndex: 0, isCorrect, answeredAt: '2026-11-12T10:00:00+08:00' }],
  };
}

function state(overrides: Partial<ReviewState> = {}): ReviewState {
  return { wrongBook: [], reviewTasks: [], sessions: [], activeSession: null, dictationHistory: [], ...overrides };
}

function ids(questions: Question[]): number[] {
  return questions.map((item) => item.id);
}

function sorted(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

function reviewed(questionId: number, lastReviewedAt: string): QuestionLearningRecord {
  return {
    questionId, firstSeenAt: lastReviewedAt, lastReviewedAt,
    answeredCount: 1, correctCount: 1, wrongCount: 0, recentErrors: [], correctRounds: [],
  };
}

function records(questions: QuestionLearningRecord[]): LearningRecords {
  return { version: 1, rounds: [], questions };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe('review selection', () => {
  it.each<ReviewKind>(['daily', 'weekly', 'wrongFirst', 'spaced'])('always includes the sole wrong word in an 18-question %s pool', (kind) => {
    const snapshot = state({ wrongBook: [wrong(1)], reviewTasks: [task([1])] });
    const selected = selectReviewQuestions(bank(18), snapshot, { kind, now: NOW });

    expect(selected).toHaveLength(10);
    expect(ids(selected)[0]).toBe(1);
    expect(new Set(ids(selected)).size).toBe(10);
  });

  it('prioritizes higher cumulative error counts and caps their influence', () => {
    const questions = bank(2);
    const choose = (firstCount: number) => ids(selectReviewQuestions(questions, state({
      wrongBook: [wrong(1, { wrongCount: firstCount }), wrong(2, { wrongCount: 2 })],
    }), { kind: 'weekly', now: NOW, count: 1 }));
    expect(choose(3)).toEqual([1]);
    expect(choose(5)).toEqual(choose(500));
  });

  it.each<ReviewKind>(['daily', 'weekly', 'spaced'])('reserves seven focus and three other old words for %s', (kind) => {
    const wrongIds = Array.from({ length: 10 }, (_, index) => index + 1);
    const snapshot = state({ wrongBook: wrongIds.map((id) => wrong(id)), reviewTasks: [task(wrongIds)] });
    const selected = ids(selectReviewQuestions(bank(20), snapshot, { kind, now: NOW }));

    expect(selected).toHaveLength(10);
    expect(selected.filter((id) => wrongIds.includes(id))).toHaveLength(7);
    expect(selected.filter((id) => !wrongIds.includes(id))).toHaveLength(3);
  });

  it('lets wrong-first use all ten slots for unmastered words', () => {
    const selected = ids(selectReviewQuestions(bank(20), state({
      wrongBook: Array.from({ length: 10 }, (_, index) => wrong(index + 1)),
    }), { kind: 'wrongFirst', now: NOW }));
    expect(selected).toHaveLength(10);
    expect(selected.every((id) => id <= 10)).toBe(true);
  });

  it('keeps mastered words out of the focus quota while allowing them as ordinary review', () => {
    const wrongBook = Array.from({ length: 11 }, (_, index) => wrong(index + 1, { mastered: index === 0 }));
    const selected = ids(selectReviewQuestions(bank(20), state({ wrongBook }), { kind: 'weekly', now: NOW }));
    expect(selected.filter((id) => id >= 2 && id <= 11)).toHaveLength(7);
    expect(selected.slice(0, 7)).not.toContain(1);
  });

  it('fills a short focus pool with ordinary words and a short ordinary pool with remaining wrong words', () => {
    const fewWrong = ids(selectReviewQuestions(bank(20), state({ wrongBook: [wrong(1), wrong(2)] }), { kind: 'weekly', now: NOW }));
    expect(fewWrong).toHaveLength(10);
    expect(fewWrong).toContain(1);
    expect(fewWrong).toContain(2);

    const manyWrong = ids(selectReviewQuestions(bank(20), state({
      wrongBook: Array.from({ length: 18 }, (_, index) => wrong(index + 1)),
    }), { kind: 'weekly', now: NOW }));
    expect(manyWrong).toHaveLength(10);
    expect(manyWrong.filter((id) => id <= 18)).toHaveLength(8);
    expect(manyWrong).toEqual(expect.arrayContaining([19, 20]));
  });

  it('does not lose unresolved wrong words when their errors leave the rolling seven-day window', () => {
    const snapshot = state({
      wrongBook: [wrong(1, { lastWrongAt: '2026-11-05T10:00:00+08:00' }), wrong(2)],
      dictationHistory: [{
        id: 'last-week', finishedAt: '2026-11-05T11:00:00+08:00',
        wrongWords: [{ word: 'word-1', meaning: '一', meaningWrongCount: 1, spellingWrongCount: 1 }],
      }],
    });
    expect(ids(selectReviewQuestions(bank(2), snapshot, { kind: 'weekly', now: NOW, count: 1 }))).toEqual([1]);
    expect(ids(selectReviewQuestions(bank(2), snapshot, { kind: 'spaced', now: NOW }))).toContain(1);
  });

  it('handles a legacy seven-day boundary by local calendar days across midnight', () => {
    const snapshot = state({ wrongBook: [wrong(1, { lastWrongAt: '2026-11-05T23:50:00+08:00' })] });
    expect(selectReviewQuestions(bank(1), snapshot, { kind: 'spaced', now: new Date('2026-11-11T23:59:00+08:00') })).toEqual([]);
    expect(ids(selectReviewQuestions(bank(1), snapshot, { kind: 'spaced', now: new Date('2026-11-12T00:01:00+08:00') }))).toEqual([1]);
  });

  it('uses real task due times across midnight instead of the age of the latest mistake', () => {
    const snapshot = state({ wrongBook: [wrong(1)], reviewTasks: [task([1], { dueAt: '2026-11-12T00:00:00+08:00' })] });
    expect(selectReviewQuestions(bank(1), snapshot, { kind: 'spaced', now: new Date('2026-11-11T23:59:00+08:00') })).toEqual([]);
    expect(ids(selectReviewQuestions(bank(1), snapshot, { kind: 'spaced', now: new Date('2026-11-12T00:01:00+08:00') }))).toEqual([1]);
  });

  it('excludes completed task subitems and fully completed tasks from spaced focus', () => {
    const snapshot = state({
      wrongBook: [wrong(1), wrong(2), wrong(3)],
      reviewTasks: [task([1, 2], { completedQuestionIds: [1] }), task([3], { id: 'done', completed: true })],
    });
    expect(ids(selectReviewQuestions(bank(4), snapshot, { kind: 'spaced', now: NOW }))).toEqual([2, 4]);
  });

  it('gives recent practice errors enough weight to outweigh a single extra historical mistake', () => {
    const snapshot = state({ wrongBook: [wrong(1, { wrongCount: 2 }), wrong(2)], sessions: [session('recent-error', 2, false)] });
    expect(ids(selectReviewQuestions(bank(2), snapshot, { kind: 'weekly', now: NOW, count: 1 }))).toEqual([2]);
  });

  it('treats the recent window as today plus six previous local days without making it an eligibility cutoff', () => {
    const baseState = state({ wrongBook: [wrong(1), wrong(2)] });
    const baseChoice = ids(selectReviewQuestions(bank(2), baseState, { kind: 'weekly', now: NOW, count: 1 }));
    const otherId = baseChoice[0] === 1 ? 2 : 1;
    const withErrorAt = (finishedAt: string) => state({
      ...baseState,
      dictationHistory: [{
        id: 'boundary', finishedAt,
        wrongWords: [{ word: `word-${otherId}`, meaning: '一', meaningWrongCount: 1, spellingWrongCount: 0 }],
      }],
    });

    expect(ids(selectReviewQuestions(bank(2), withErrorAt('2026-11-05T23:59:59+08:00'), { kind: 'weekly', now: NOW, count: 1 }))).toEqual(baseChoice);
    expect(ids(selectReviewQuestions(bank(2), withErrorAt('2026-11-06T00:00:00+08:00'), { kind: 'weekly', now: NOW, count: 1 }))).toEqual([otherId]);
    expect(selectReviewQuestions(bank(2), withErrorAt('2026-11-06T00:00:00+08:00'), {
      kind: 'weekly', now: new Date('2026-11-13T00:01:00+08:00'),
    })).toHaveLength(2);
  });

  it('prioritizes a due task but removes its bonus after that question is completed', () => {
    const wrongBook = [wrong(1, { wrongCount: 5 }), wrong(2)];
    const dueState = state({ wrongBook, reviewTasks: [task([2])] });
    const doneState = state({ wrongBook, reviewTasks: [task([2], { completedQuestionIds: [2] })] });
    expect(ids(selectReviewQuestions(bank(2), dueState, { kind: 'weekly', now: NOW, count: 1 }))).toEqual([2]);
    expect(ids(selectReviewQuestions(bank(2), doneState, { kind: 'weekly', now: NOW, count: 1 }))).toEqual([1]);
  });

  it('weights recent dictation spelling errors more than meaning errors', () => {
    const snapshot = state({
      wrongBook: [wrong(1), wrong(2)],
      dictationHistory: [{
        id: 'recent-dictation', finishedAt: '2026-11-12T10:00:00+08:00',
        wrongWords: [
          { word: 'word-1', meaning: '一', meaningWrongCount: 1, spellingWrongCount: 0 },
          { word: 'word-2', meaning: '二', meaningWrongCount: 0, spellingWrongCount: 1 },
        ],
      }],
    });
    expect(ids(selectReviewQuestions(bank(2), snapshot, { kind: 'weekly', now: NOW, count: 1 }))).toEqual([2]);
  });

  it('lowers priority after a correct answer in a later independent round without marking the word mastered', () => {
    const wrongBook = [wrong(1, { wrongCount: 5 }), wrong(2, { wrongCount: 4 })];
    const choose = (sessions: StudySession[]) => ids(selectReviewQuestions(bank(2), state({ wrongBook, sessions }), { kind: 'weekly', now: NOW, count: 1 }));
    expect(choose([])).toEqual([1]);
    expect(choose([session('later-correct', 1, true)])).toEqual([2]);
    expect(choose([session('same-error-round', 1, true, '2026-11-11T09:00:00+08:00')])).toEqual([1]);
    expect(wrongBook[0].mastered).toBe(false);
  });

  it('does not count one round twice when it is also the active session', () => {
    const activeSession = session('same-round', 2, false);
    const snapshot = state({ wrongBook: [wrong(1, { wrongCount: 4 }), wrong(2)], sessions: [activeSession], activeSession });
    const single = selectReviewQuestions(bank(2), { ...snapshot, activeSession: null }, { kind: 'weekly', now: NOW, count: 1 });
    expect(ids(selectReviewQuestions(bank(2), snapshot, { kind: 'weekly', now: NOW, count: 1 }))).toEqual(ids(single));
    expect(ids(single)).toEqual([1]);
  });

  it('ignores invalid and future evidence dates for recent-error and due-task bonuses', () => {
    const wrongBook = [wrong(1), wrong(2)];
    const baseline = ids(selectReviewQuestions(bank(2), state({ wrongBook }), { kind: 'weekly', now: NOW, count: 1 }));
    const otherId = baseline[0] === 1 ? 2 : 1;
    const futureSession = session('future', otherId, false, '2026-11-13T09:00:00+08:00');
    futureSession.answers[0].answeredAt = '2026-11-13T10:00:00+08:00';
    const invalidSession = session('invalid', otherId, false);
    invalidSession.answers[0].answeredAt = 'invalid';
    const snapshot = state({
      wrongBook,
      sessions: [futureSession, invalidSession],
      reviewTasks: [task([otherId], { dueAt: '2026-11-13T10:00:00+08:00' }), task([otherId], { id: 'invalid', dueAt: 'invalid' })],
      dictationHistory: ['invalid', '2026-11-13T10:00:00+08:00'].map((finishedAt, index) => ({
        id: `bad-date-${index}`, finishedAt,
        wrongWords: [{ word: `word-${otherId}`, meaning: '一', meaningWrongCount: 100, spellingWrongCount: 100 }],
      })),
    });
    expect(ids(selectReviewQuestions(bank(2), snapshot, { kind: 'weekly', now: NOW, count: 1 }))).toEqual(baseline);
    expect(selectReviewQuestions(bank(2), snapshot, { kind: 'spaced', now: NOW })).toEqual([]);
  });

  it('does not grant a seven-day bonus to an invalid or future last-error date', () => {
    const choose = (lastWrongAt: string) => ids(selectReviewQuestions(bank(2), state({
      wrongBook: [wrong(1, { wrongCount: 2 }), wrong(2, { lastWrongAt })],
    }), { kind: 'weekly', now: NOW, count: 1 }));
    expect(choose('invalid')).toEqual([1]);
    expect(choose('2026-11-13T10:00:00+08:00')).toEqual([1]);
  });

  it('keeps weekly candidates limited to archived, previously answered, wrong-book and task words', () => {
    const questions = bank(6, false);
    questions[0] = question(1);
    const snapshot = state({
      sessions: [session('seen', 2, true)], activeSession: session('active', 5, true),
      wrongBook: [wrong(3)], reviewTasks: [task([4], { dueAt: '2026-11-13T10:00:00+08:00' })],
    });
    const selected = ids(selectReviewQuestions(questions, snapshot, { kind: 'weekly', now: NOW }));
    expect(selected).toHaveLength(5);
    expect([...selected].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('prioritizes archived words for ordinary daily slots', () => {
    const questions = [...bank(5, false), ...Array.from({ length: 15 }, (_, index) => question(index + 6))];
    const selected = selectReviewQuestions(questions, state(), { kind: 'daily', now: NOW });
    expect(selected).toHaveLength(10);
    expect(selected.every((item) => item.tags.includes('archived-dictation'))).toBe(true);
  });

  it('handles no history and short banks without introducing unseen weekly or spaced questions', () => {
    expect(selectReviewQuestions([], state(), { kind: 'daily', now: NOW })).toEqual([]);
    expect(selectReviewQuestions(bank(18, false), state(), { kind: 'weekly', now: NOW })).toEqual([]);
    expect(selectReviewQuestions(bank(18, false), state(), { kind: 'spaced', now: NOW })).toEqual([]);
    expect(selectReviewQuestions(bank(18, false), state(), { kind: 'daily', now: NOW })).toHaveLength(10);
    expect(selectReviewQuestions(bank(3), state(), { kind: 'weekly', now: NOW })).toHaveLength(3);
    expect(selectReviewQuestions(bank(3), state(), { kind: 'weekly', now: NOW, count: 0 })).toEqual([]);
  });

  it('deduplicates question IDs, is stable within one day and does not mutate frozen inputs', () => {
    const questions = [...bank(18), question(1)];
    const snapshot = state({ wrongBook: [wrong(1)], reviewTasks: [task([1, 1])] });
    const originalBank = structuredClone(questions);
    const originalState = structuredClone(snapshot);
    deepFreeze(questions);
    deepFreeze(snapshot);
    const selected = selectReviewQuestions(questions, snapshot, { kind: 'weekly', now: NOW });
    const later = selectReviewQuestions(questions, snapshot, { kind: 'weekly', now: new Date('2026-11-12T23:00:00+08:00') });
    expect(ids(later)).toEqual(ids(selected));
    expect(new Set(ids(selected)).size).toBe(10);
    expect(questions).toEqual(originalBank);
    expect(snapshot).toEqual(originalState);
  });

  it('starts the next round with the old words that were left out instead of repeating the same ten', () => {
    const questions = bank(15);
    const first = ids(selectReviewQuestions(questions, state(), { kind: 'daily', now: NOW }));
    const afterFirstRound = state({
      learningRecords: records(first.map((id, index) => reviewed(id, `2026-11-12T10:0${index}:00+08:00`))),
    });
    const second = ids(selectReviewQuestions(questions, afterFirstRound, { kind: 'daily', now: new Date('2026-11-13T12:00:00+08:00') }));
    const leftOut = questions.map((item) => item.id).filter((id) => !first.includes(id));

    expect(first).toHaveLength(10);
    // The five left out come back, together with the five that were answered earliest in the first round.
    expect(sorted(second)).toEqual(sorted([...leftOut, ...first.slice(0, 5)]));
  });

  it.each<ReviewKind>(['daily', 'weekly', 'spaced', 'wrongFirst'])('reaches all 32 old words in four recorded %s rounds', (kind) => {
    const questions = bank(32);
    let history: QuestionLearningRecord[] = [];
    const seen = new Set<number>();
    for (let day = 0; day < 4; day += 1) {
      const now = new Date(NOW.getTime() + day * 86_400_000);
      const picked = ids(selectReviewQuestions(questions, state({ learningRecords: records(history) }), { kind, now }));
      expect(picked).toHaveLength(10);
      picked.forEach((id) => seen.add(id));
      history = [
        ...history.filter((item) => !picked.includes(item.questionId)),
        ...picked.map((id, index) => reviewed(id, new Date(now.getTime() + index * 1000).toISOString())),
      ];
    }
    expect(seen.size).toBe(32);
  });

  it('keeps the same plan for the whole day until a round is actually recorded', () => {
    const questions = bank(32);
    const snapshot = state({ learningRecords: records(Array.from({ length: 12 }, (_, index) => reviewed(index + 1, `2026-11-1${index % 3}T10:00:00+08:00`))) });
    const morning = ids(selectReviewQuestions(questions, snapshot, { kind: 'weekly', now: NOW }));
    const evening = ids(selectReviewQuestions(questions, snapshot, { kind: 'weekly', now: new Date('2026-11-12T23:00:00+08:00') }));
    expect(evening).toEqual(morning);
  });

  it('lets studied words of the current lesson take turns in weekly review while daily review keeps archived lessons first', () => {
    const currentLesson = Array.from({ length: 6 }, (_, index) => question(101 + index, false));
    const questions = [...bank(12), ...currentLesson];
    const snapshot = state({
      learningRecords: records([
        ...Array.from({ length: 12 }, (_, index) => reviewed(index + 1, `2026-11-12T09:${10 + index}:00+08:00`)),
        ...currentLesson.map((item, index) => reviewed(item.id, `2026-11-10T09:${10 + index}:00+08:00`)),
      ]),
    });

    const weekly = ids(selectReviewQuestions(questions, snapshot, { kind: 'weekly', now: NOW }));
    expect(sorted(weekly)).toEqual([1, 2, 3, 4, 101, 102, 103, 104, 105, 106]);

    const daily = ids(selectReviewQuestions(questions, snapshot, { kind: 'daily', now: NOW }));
    expect(sorted(daily)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('ignores invalid and future review times when ordering old words', () => {
    const questions = bank(3);
    const snapshot = state({
      learningRecords: records([
        reviewed(1, '2026-11-11T10:00:00+08:00'),
        { ...reviewed(2, '2026-11-10T10:00:00+08:00'), lastReviewedAt: '2026-11-20T10:00:00+08:00' },
        { ...reviewed(3, '2026-11-09T10:00:00+08:00'), lastReviewedAt: 'invalid' },
      ]),
    });
    // Both count as never reviewed, so they are picked before the word with a real review time.
    expect(sorted(ids(selectReviewQuestions(questions, snapshot, { kind: 'weekly', now: NOW, count: 2 })))).toEqual([2, 3]);
  });

  it('shows the same picked old words in a different order on other days and keeps one order within a day', () => {
    const questions = bank(10);
    const pick = (time: string) => ids(selectReviewQuestions(questions, state(), { kind: 'weekly', now: new Date(time) }));
    const monday = pick('2026-11-16T09:00:00+08:00');
    const otherDays = ['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'].map((day) => pick(`${day}T09:00:00+08:00`));

    expect(pick('2026-11-16T21:00:00+08:00')).toEqual(monday);
    otherDays.forEach((order) => expect(sorted(order)).toEqual(sorted(monday)));
    expect(new Set([monday, ...otherDays].map((order) => order.join())).size).toBe(5);
  });

  it('keeps unmastered wrong words in front of the shuffled old words', () => {
    const snapshot = state({ wrongBook: [wrong(4, { wrongCount: 3 }), wrong(9)] });
    ['2026-11-16', '2026-11-17', '2026-11-18'].forEach((day) => {
      const order = ids(selectReviewQuestions(bank(12), snapshot, { kind: 'weekly', now: new Date(`${day}T09:00:00+08:00`) }));
      expect(order.slice(0, 2)).toEqual([4, 9]);
    });
  });
});

describe('least recently reviewed pick', () => {
  it('covers a 17-word lesson in two rounds of ten', () => {
    const lesson = bank(17, false);
    const first = ids(pickLeastRecentlyReviewed(lesson, state(), { now: NOW }));
    const afterFirstRound = state({
      learningRecords: records(first.map((id, index) => reviewed(id, `2026-11-12T10:0${index}:00+08:00`))),
    });
    const second = ids(pickLeastRecentlyReviewed(lesson, afterFirstRound, { now: NOW }));

    expect(first).toHaveLength(10);
    expect(second).toHaveLength(10);
    expect(new Set([...first, ...second]).size).toBe(17);
    // The three repeats are the ones answered earliest in the first round.
    expect(sorted(second.filter((id) => first.includes(id)))).toEqual(sorted(first.slice(0, 3)));
  });

  it('presents the same lesson words in a different order on another day', () => {
    const lesson = bank(10, false);
    const monday = ids(pickLeastRecentlyReviewed(lesson, state(), { now: new Date('2026-11-16T09:00:00+08:00') }));
    const tuesday = ids(pickLeastRecentlyReviewed(lesson, state(), { now: new Date('2026-11-17T09:00:00+08:00') }));

    expect(ids(pickLeastRecentlyReviewed(lesson, state(), { now: new Date('2026-11-16T20:00:00+08:00') }))).toEqual(monday);
    expect(sorted(tuesday)).toEqual(sorted(monday));
    expect(tuesday).not.toEqual(monday);
  });

  it('counts answers of the round in progress, deduplicates IDs and does not mutate frozen inputs', () => {
    const lesson = [...bank(12, false), question(1, false)];
    const snapshot = state({ learningRecords: records([]), activeSession: session('in-progress', 1, true) });
    deepFreeze(lesson);
    deepFreeze(snapshot);
    const picked = ids(pickLeastRecentlyReviewed(lesson, snapshot, { now: NOW, count: 11 }));

    expect(picked).toHaveLength(11);
    expect(new Set(picked).size).toBe(11);
    expect(picked).not.toContain(1);
    expect(pickLeastRecentlyReviewed(lesson, snapshot, { now: NOW, count: 0 })).toEqual([]);
  });
});
