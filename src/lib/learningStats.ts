import type { AppState, CompletedTrainingSummary, Question } from '../types/schema';
import { getLearningRecords } from './learningRecords';
import { getLocalDaySeed, PRACTICE_SESSION_QUESTION_COUNT } from './practiceUtils';

export const DAILY_QUESTION_GOAL = PRACTICE_SESSION_QUESTION_COUNT;
export const DAILY_MINUTE_GOAL = 10;

const TECHNICAL_TAGS = new Set(['vocab', 'vocab-qa', 'dialogue-qa', 'auto-generated', 'user-custom', 'daily-dictation', 'archived-dictation']);

function isVocabulary(question: Question): boolean {
  return question.tags.includes('vocab') || question.tags.includes('vocab-qa');
}

export function getTrainingAccuracy(round: CompletedTrainingSummary): number | null {
  if (!round.totalsKnown || !round.questionTotal || round.correctCount === undefined) return null;
  return Math.round((round.correctCount / round.questionTotal) * 100);
}

function summarizeAccuracy(rounds: CompletedTrainingSummary[]): number | null {
  const known = rounds.filter((round) => getTrainingAccuracy(round) !== null);
  const total = known.reduce((sum, round) => sum + round.questionTotal!, 0);
  if (!total) return null;
  return Math.round((known.reduce((sum, round) => sum + round.correctCount!, 0) / total) * 100);
}

function countStreak(days: Set<string>, now: Date): number {
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(getLocalDaySeed(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(getLocalDaySeed(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getLearningStatistics(state: AppState, bank: Question[], now = new Date()) {
  const records = getLearningRecords(state, bank);
  const timestamp = now.getTime();
  const rounds = records.rounds
    .filter((round) => Number.isFinite(Date.parse(round.finishedAt)) && Date.parse(round.finishedAt) <= timestamp)
    .sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt));
  const today = getLocalDaySeed(now);
  const weeklyStart = new Date(now);
  weeklyStart.setHours(0, 0, 0, 0);
  weeklyStart.setDate(weeklyStart.getDate() - 6);
  const weekly = rounds.filter((round) => Date.parse(round.finishedAt) >= weeklyStart.getTime());
  const todayRounds = rounds.filter((round) => getLocalDaySeed(new Date(round.finishedAt)) === today);
  const dayFrequency = new Map<string, number>();
  rounds.forEach((round) => {
    const day = getLocalDaySeed(new Date(round.finishedAt));
    dayFrequency.set(day, (dayFrequency.get(day) ?? 0) + 1);
  });

  const questionById = new Map(bank.map((question) => [question.id, question]));
  const learnedIds = new Set(records.questions
    .filter((record) => questionById.has(record.questionId) && Date.parse(record.firstSeenAt) <= timestamp)
    .map((record) => record.questionId));
  const vocabulary = bank.filter(isVocabulary);
  const wordKey = (question: Question) => question.prompt.trim().toLowerCase();
  const vocabularyWords = new Set(vocabulary.map(wordKey));
  const learnedWords = new Set(vocabulary.filter((question) => learnedIds.has(question.id)).map(wordKey));
  const masteredIds = new Set(state.wrongBook.filter((item) => item.mastered).map((item) => item.questionId));
  const markedMasteredWords = new Set(vocabulary.filter((question) => masteredIds.has(question.id)).map(wordKey));
  const weakTags = new Map<string, number>();
  state.wrongBook.filter((item) => !item.mastered).forEach((item) => {
    const question = questionById.get(item.questionId);
    question?.tags.filter((tag) => !TECHNICAL_TAGS.has(tag)).forEach((tag) => {
      weakTags.set(tag, (weakTags.get(tag) ?? 0) + item.wrongCount);
    });
  });

  const units = new Map<number, { done: number; total: number }>();
  bank.forEach((question) => {
    const unit = units.get(question.unit) ?? { done: 0, total: 0 };
    units.set(question.unit, { done: unit.done + Number(learnedIds.has(question.id)), total: unit.total + 1 });
  });
  const todayDurationSeconds = todayRounds.reduce((sum, round) => sum + (round.durationSeconds ?? 0), 0);

  return {
    rounds,
    latest: rounds[0],
    recentRounds: rounds.slice(0, 7),
    totalRounds: rounds.length,
    totalAnswered: rounds.reduce((sum, round) => sum + round.answeredCount, 0),
    accuracy: summarizeAccuracy(rounds),
    weeklyRounds: weekly.length,
    weeklyAccuracy: summarizeAccuracy(weekly),
    todayAnswered: todayRounds.reduce((sum, round) => sum + round.answeredCount, 0),
    todayMinutes: Math.round((todayDurationSeconds / 60) * 10) / 10,
    todayDailyAnswered: todayRounds.filter((round) => round.train === 'daily20').reduce((sum, round) => sum + round.answeredCount, 0),
    todayLevelRounds: todayRounds.filter((round) => round.train === 'level10').length,
    totalMinutes: Math.round(rounds.reduce((sum, round) => sum + (round.durationSeconds ?? 0), 0) / 60),
    learningDays: dayFrequency.size,
    streakDays: countStreak(new Set(dayFrequency.keys()), now),
    dayFrequency: [...dayFrequency.entries()].sort(([a], [b]) => a.localeCompare(b)),
    learnedWordCount: learnedWords.size,
    mastery: {
      unseen: vocabularyWords.size - new Set([...learnedWords, ...markedMasteredWords]).size,
      practiced: [...learnedWords].filter((word) => !markedMasteredWords.has(word)).length,
      markedMastered: markedMasteredWords.size,
    },
    unitProgress: [...units.entries()].sort(([a], [b]) => a - b).map(([unit, value]) => ({
      unit,
      ...value,
      percent: Math.round((value.done / value.total) * 100),
    })),
    weakTags: [...weakTags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
}
