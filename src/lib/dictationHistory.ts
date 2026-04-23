import type { DictationHistoryEntry, DictationWeeklyWordSummary } from '../types/schema';
import { summarizeWrongDictationAnswers, type DictationAnswerRecord } from './dictationSummary';

export function createDictationHistoryEntry(
  answers: DictationAnswerRecord[],
  finishedAt: string,
  id: string,
): DictationHistoryEntry {
  const wrongWords = summarizeWrongDictationAnswers(answers).map((item) => ({
    word: item.word,
    meaning: item.meaning,
    meaningWrongCount: item.meaningMistakes.length,
    spellingWrongCount: item.spellingMistakes.length,
  }));

  return {
    id,
    finishedAt,
    wrongWords,
  };
}

function getRecentDaysStart(days: number, now: Date): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start.getTime();
}

export function summarizeWeeklyDictationHistory(
  history: DictationHistoryEntry[],
  now = new Date(),
): DictationWeeklyWordSummary[] {
  const weeklyStart = getRecentDaysStart(7, now);

  const summaryMap = history.reduce<Map<string, DictationWeeklyWordSummary>>((acc, entry) => {
    const finishedAt = new Date(entry.finishedAt).getTime();
    if (Number.isNaN(finishedAt) || finishedAt < weeklyStart) {
      return acc;
    }

    entry.wrongWords.forEach((item) => {
      const existing = acc.get(item.word);
      const nextItem = existing ?? {
        word: item.word,
        meaning: item.meaning,
        totalWrongCount: 0,
        meaningWrongCount: 0,
        spellingWrongCount: 0,
        primaryWeakness: 'both' as const,
      };

      nextItem.meaningWrongCount += item.meaningWrongCount;
      nextItem.spellingWrongCount += item.spellingWrongCount;
      nextItem.totalWrongCount += item.meaningWrongCount + item.spellingWrongCount;

      if (nextItem.meaningWrongCount > nextItem.spellingWrongCount) {
        nextItem.primaryWeakness = 'meaning';
      } else if (nextItem.spellingWrongCount > nextItem.meaningWrongCount) {
        nextItem.primaryWeakness = 'spelling';
      } else {
        nextItem.primaryWeakness = 'both';
      }

      acc.set(item.word, nextItem);
    });

    return acc;
  }, new Map());

  return Array.from(summaryMap.values()).sort((a, b) => {
    if (b.totalWrongCount !== a.totalWrongCount) {
      return b.totalWrongCount - a.totalWrongCount;
    }

    return a.word.localeCompare(b.word);
  });
}
