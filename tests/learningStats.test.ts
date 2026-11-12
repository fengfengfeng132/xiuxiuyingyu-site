import { describe, expect, it } from 'vitest';
import { getLearningStatistics } from '../src/lib/learningStats';
import { createLearningRecords, recordCompletedTraining } from '../src/lib/learningRecords';
import type { AppState, CompletedTrainingInput, Question } from '../src/types/schema';

const NOW = new Date('2026-11-12T12:00:00+08:00');
const bank: Question[] = [1, 2, 3].map((id) => ({
  id, level: 'L2', unit: 1, type: 'single_choice', prompt: id < 3 ? 'baby' : 'clean',
  stem: '选出意思', options: ['一', '二'], answerIndex: 0, explanation: '解释', tags: ['vocab'],
}));

function emptyState(): AppState {
  return {
    activeSession: null, sessions: [], wrongBook: [], reviewTasks: [], dictationHistory: [],
    starRecords: [], localAudioFiles: {}, learningRecords: createLearningRecords(),
  };
}

function input(id: string, day: number, overrides: Partial<CompletedTrainingInput> = {}): CompletedTrainingInput {
  const startedAt = `2026-11-${day}T09:00:00+08:00`;
  const finishedAt = `2026-11-${day}T09:02:00+08:00`;
  return {
    id, source: 'practice', title: '日常学习', train: 'daily20', mode: 'vocab',
    startedAt, finishedAt, questionTotal: 1,
    answers: [{ questionId: 1, isCorrect: true, kind: 'practice', answeredAt: finishedAt }],
    ...overrides,
  };
}

describe('learning statistics', () => {
  it('starts with empty statistics and no invented achievements', () => {
    expect(getLearningStatistics(emptyState(), bank, NOW)).toMatchObject({
      totalRounds: 0, totalAnswered: 0, accuracy: null, weeklyAccuracy: null,
      todayMinutes: 0, streakDays: 0, learningDays: 0, learnedWordCount: 0,
      mastery: { unseen: 2, practiced: 0, markedMastered: 0 },
    });
  });

  it('counts actual calendar days and unique words across practice and dictation', () => {
    let state = recordCompletedTraining(emptyState(), input('yesterday', 11));
    state = recordCompletedTraining(state, input('morning', 12));
    state = recordCompletedTraining(state, input('dictation', 12, {
      source: 'dictation', train: 'dictation', title: '每日听写', questionTotal: 2,
      answers: [
        { questionId: 2, isCorrect: true, kind: 'meaning', answeredAt: '2026-11-12T09:01:00+08:00' },
        { questionId: 2, isCorrect: false, kind: 'spelling', answeredAt: '2026-11-12T09:02:00+08:00' },
      ],
    }));
    const stats = getLearningStatistics(state, bank, NOW);
    expect(stats).toMatchObject({
      totalRounds: 3, totalAnswered: 4, accuracy: 75, weeklyRounds: 3,
      learningDays: 2, streakDays: 2, learnedWordCount: 1,
      todayMinutes: 4, totalMinutes: 6, todayDailyAnswered: 1,
    });
    expect(stats.recentRounds.some((round) => round.source === 'dictation')).toBe(true);
    expect(stats.unitProgress[0]).toMatchObject({ done: 2, total: 3 });
  });

  it('does not manufacture complete grades or duration from legacy wrong-only history', () => {
    const state = emptyState();
    state.learningRecords!.rounds = [{
      id: 'legacy', source: 'dictation', title: '历史听写', finishedAt: '2026-11-12T09:00:00+08:00',
      totalsKnown: false, answeredCount: 2, questionIds: [1],
    }];
    const stats = getLearningStatistics(state, bank, NOW);
    expect(stats).toMatchObject({ totalRounds: 1, totalAnswered: 2, accuracy: null, totalMinutes: 0 });
  });

  it('keeps manual mastery separate from practice and excludes future activity', () => {
    let state = recordCompletedTraining(emptyState(), input('level', 11, { train: 'level10' }));
    state = recordCompletedTraining(state, input('future', 13, {
      answers: [{ questionId: 3, isCorrect: true, kind: 'practice', answeredAt: '2026-11-13T09:02:00+08:00' }],
    }));
    state.wrongBook = [{ questionId: 2, mastered: true, wrongCount: 1, lastWrongAt: '2026-11-11T08:00:00+08:00' }];
    expect(getLearningStatistics(state, bank, NOW)).toMatchObject({
      totalRounds: 1, learningDays: 1, streakDays: 1, todayLevelRounds: 0,
      learnedWordCount: 1, mastery: { unseen: 1, practiced: 0, markedMastered: 1 },
    });
  });

  it('keeps statistics after detailed session retention and does not mutate the ledger', () => {
    const state = recordCompletedTraining(emptyState(), input('round', 12));
    const before = JSON.stringify(state);
    const stats = getLearningStatistics(state, bank, NOW);
    expect(state.sessions).toHaveLength(0);
    expect(stats.totalRounds).toBe(1);
    expect(JSON.stringify(state)).toBe(before);
  });
});
