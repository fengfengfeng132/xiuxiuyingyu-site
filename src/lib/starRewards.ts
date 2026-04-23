import type { AppState, StarRecord } from '../types/schema';

export interface StarAwardInput {
  sourceType: StarRecord['sourceType'];
  sourceId: string;
  title: string;
  score: number;
  total: number;
  earnedAt?: string;
}

export interface StarAwardResult {
  state: AppState;
  awarded: boolean;
}

export function isPerfectTraining(score: number, total: number): boolean {
  return total > 0 && score === total;
}

export function getStarCount(state: AppState): number {
  return state.starRecords.length;
}

export function awardPerfectTrainingStar(state: AppState, input: StarAwardInput): StarAwardResult {
  if (!isPerfectTraining(input.score, input.total)) {
    return { state, awarded: false };
  }

  const hasExistingReward = state.starRecords.some(
    (record) => record.sourceType === input.sourceType && record.sourceId === input.sourceId,
  );
  if (hasExistingReward) {
    return { state, awarded: false };
  }

  const record: StarRecord = {
    id: `${input.sourceType}-${input.sourceId}`,
    earnedAt: input.earnedAt ?? new Date().toISOString(),
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    title: input.title,
    score: input.score,
    total: input.total,
  };

  return {
    state: {
      ...state,
      starRecords: [record, ...state.starRecords],
    },
    awarded: true,
  };
}
