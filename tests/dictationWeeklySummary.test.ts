import { describe, expect, it } from 'vitest';
import { summarizeWeeklyDictationHistory } from '../src/lib/dictationHistory';
import type { DictationHistoryEntry } from '../src/types/schema';

function makeEntry(overrides: Partial<DictationHistoryEntry>): DictationHistoryEntry {
  return {
    id: 'round-1',
    finishedAt: '2026-04-22T10:00:00+08:00',
    wrongWords: [
      {
        word: 'hot',
        meaning: '热的',
        meaningWrongCount: 1,
        spellingWrongCount: 0,
      },
    ],
    ...overrides,
  };
}

describe('dictationHistory weekly summary', () => {
  it('aggregates the last 7 days by word and identifies the main weak area', () => {
    const summary = summarizeWeeklyDictationHistory(
      [
        makeEntry({
          id: 'round-1',
          finishedAt: '2026-04-22T10:00:00+08:00',
          wrongWords: [
            {
              word: 'hot',
              meaning: '热的',
              meaningWrongCount: 1,
              spellingWrongCount: 0,
            },
            {
              word: 'same',
              meaning: '相同的',
              meaningWrongCount: 0,
              spellingWrongCount: 1,
            },
          ],
        }),
        makeEntry({
          id: 'round-2',
          finishedAt: '2026-04-20T10:00:00+08:00',
          wrongWords: [
            {
              word: 'hot',
              meaning: '热的',
              meaningWrongCount: 0,
              spellingWrongCount: 2,
            },
          ],
        }),
        makeEntry({
          id: 'round-3',
          finishedAt: '2026-04-14T10:00:00+08:00',
          wrongWords: [
            {
              word: 'hot',
              meaning: '热的',
              meaningWrongCount: 3,
              spellingWrongCount: 0,
            },
          ],
        }),
      ],
      new Date('2026-04-22T12:00:00+08:00'),
    );

    expect(summary).toEqual([
      {
        word: 'hot',
        meaning: '热的',
        totalWrongCount: 3,
        meaningWrongCount: 1,
        spellingWrongCount: 2,
        primaryWeakness: 'spelling',
      },
      {
        word: 'same',
        meaning: '相同的',
        totalWrongCount: 1,
        meaningWrongCount: 0,
        spellingWrongCount: 1,
        primaryWeakness: 'spelling',
      },
    ]);
  });

  it('returns both when meaning and spelling mistakes are equally frequent', () => {
    const summary = summarizeWeeklyDictationHistory(
      [
        makeEntry({
          id: 'round-1',
          wrongWords: [
            {
              word: 'cake',
              meaning: '蛋糕',
              meaningWrongCount: 1,
              spellingWrongCount: 1,
            },
          ],
        }),
      ],
      new Date('2026-04-22T12:00:00+08:00'),
    );

    expect(summary).toEqual([
      {
        word: 'cake',
        meaning: '蛋糕',
        totalWrongCount: 2,
        meaningWrongCount: 1,
        spellingWrongCount: 1,
        primaryWeakness: 'both',
      },
    ]);
  });
});
