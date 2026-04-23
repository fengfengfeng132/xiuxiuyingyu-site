import { describe, expect, it } from 'vitest';
import { awardPerfectTrainingStar, getStarCount, isPerfectTraining } from '../src/lib/starRewards';
import type { AppState } from '../src/types/schema';

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    activeSession: null,
    sessions: [],
    wrongBook: [],
    dictationHistory: [],
    reviewTasks: [],
    starRecords: [],
    localAudioFiles: {},
    ...overrides,
  };
}

describe('starRewards', () => {
  it('only treats a complete full-score training as perfect', () => {
    expect(isPerfectTraining(10, 10)).toBe(true);
    expect(isPerfectTraining(9, 10)).toBe(false);
    expect(isPerfectTraining(0, 0)).toBe(false);
  });

  it('adds one star record for a perfect training', () => {
    const result = awardPerfectTrainingStar(makeState(), {
      sourceType: 'practice',
      sourceId: 'session-1',
      title: '今日10分钟',
      score: 10,
      total: 10,
      earnedAt: '2026-04-23T10:00:00.000Z',
    });

    expect(result.awarded).toBe(true);
    expect(getStarCount(result.state)).toBe(1);
    expect(result.state.starRecords[0]).toMatchObject({
      id: 'practice-session-1',
      sourceType: 'practice',
      sourceId: 'session-1',
      title: '今日10分钟',
      score: 10,
      total: 10,
    });
  });

  it('does not award duplicate stars for the same completed training', () => {
    const first = awardPerfectTrainingStar(makeState(), {
      sourceType: 'dictation',
      sourceId: 'round-1',
      title: '每日听写',
      score: 20,
      total: 20,
    });

    const second = awardPerfectTrainingStar(first.state, {
      sourceType: 'dictation',
      sourceId: 'round-1',
      title: '每日听写',
      score: 20,
      total: 20,
    });

    expect(first.awarded).toBe(true);
    expect(second.awarded).toBe(false);
    expect(getStarCount(second.state)).toBe(1);
  });
});
