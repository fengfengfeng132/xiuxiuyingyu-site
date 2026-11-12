import type { AppState, Question, StudySession, WrongItem } from '../types/schema';
import { pickDailyQuestions, PRACTICE_SESSION_QUESTION_COUNT } from './practiceUtils';
import { getPendingReviewQuestionIds } from './reviewProgress';

export type ReviewKind = 'daily' | 'weekly' | 'wrongFirst' | 'spaced';
export const REVIEW_FOCUS_RATIO = 0.7;

const CUMULATIVE_ERROR_LIMIT = 5;
const CUMULATIVE_ERROR_WEIGHT = 4;
const RECENT_PRACTICE_ERROR_WEIGHT = 8;
const RECENT_MEANING_ERROR_WEIGHT = 6;
const RECENT_SPELLING_ERROR_WEIGHT = 10;
const RECENT_ERROR_BONUS_LIMIT = 40;
const DUE_REVIEW_BONUS = 20;
const WEEK_OLD_UNREVIEWED_BONUS = 15;
const CORRECT_ROUND_DISCOUNT = 8;
const CORRECT_ROUND_LIMIT = 3;
const RECENT_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

type ReviewState = Pick<AppState, 'wrongBook' | 'reviewTasks' | 'sessions' | 'activeSession' | 'dictationHistory' | 'learningRecords'>;

interface PracticeEvidence {
  recentErrors: number;
  correctRoundsAfterWrong: number;
  reviewedAfterWrong: boolean;
}

function validPastTime(value: string, now: number): number | null {
  const time = Date.parse(value);
  return Number.isFinite(time) && time <= now ? time : null;
}

function localDayNumber(time: number): number {
  const date = new Date(time);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

function getRecentWindowStart(now: Date): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (RECENT_WINDOW_DAYS - 1));
  return start.getTime();
}

function uniqueSessions(state: ReviewState): StudySession[] {
  if (state.learningRecords) {
    const active = state.activeSession;
    if (!active || state.learningRecords.rounds.some((round) => round.source === 'practice' && round.id === active.id)) return [];
    return [active];
  }
  const sessions = state.activeSession ? [...state.sessions, state.activeSession] : state.sessions;
  return [...new Map(sessions.map((session) => [session.id, session])).values()];
}

function collectPracticeEvidence(
  state: ReviewState,
  wrongById: ReadonlyMap<number, WrongItem>,
  now: number,
  recentStart: number,
): { seenIds: Set<number>; evidence: Map<number, PracticeEvidence>; lastReviewedAt: Map<number, number> } {
  const seenIds = new Set<number>();
  const evidence = new Map<number, PracticeEvidence>();
  const lastReviewedAt = new Map<number, number>();
  const markReviewed = (questionId: number, time: number | null) => {
    if (time !== null && time > (lastReviewedAt.get(questionId) ?? 0)) lastReviewedAt.set(questionId, time);
  };

  state.learningRecords?.questions.forEach((record) => {
    if (validPastTime(record.firstSeenAt, now) === null) return;
    seenIds.add(record.questionId);
    markReviewed(record.questionId, validPastTime(record.lastReviewedAt, now));
    const wrong = wrongById.get(record.questionId);
    const lastWrongAt = wrong ? validPastTime(wrong.lastWrongAt, now) : null;
    const correctRounds = record.correctRounds.filter((round) => {
      const startedAt = validPastTime(round.startedAt, now);
      return startedAt !== null && validPastTime(round.answeredAt, now) !== null
        && lastWrongAt !== null && startedAt > lastWrongAt;
    });
    const recentErrors = record.recentErrors.reduce((total, day) => {
      const answeredAt = validPastTime(day.lastAnsweredAt, now);
      return answeredAt !== null && answeredAt >= recentStart ? total + day.practice : total;
    }, 0);
    evidence.set(record.questionId, {
      recentErrors, correctRoundsAfterWrong: correctRounds.length, reviewedAfterWrong: correctRounds.length > 0,
    });
  });

  uniqueSessions(state).forEach((session) => {
    const startedAt = validPastTime(session.startedAt, now);
    if (startedAt === null) return;
    const answersById = new Map(session.answers.map((answer) => [answer.questionId, answer]));
    answersById.forEach((answer) => {
      const answeredAt = validPastTime(answer.answeredAt, now);
      if (answeredAt === null || answeredAt < startedAt) return;
      seenIds.add(answer.questionId);
      markReviewed(answer.questionId, answeredAt);
      const item = evidence.get(answer.questionId) ?? { recentErrors: 0, correctRoundsAfterWrong: 0, reviewedAfterWrong: false };
      if (!answer.isCorrect && answeredAt >= recentStart) item.recentErrors += 1;

      const wrong = wrongById.get(answer.questionId);
      const lastWrongAt = wrong ? validPastTime(wrong.lastWrongAt, now) : null;
      // A later round is independent evidence; the original error round is not a review.
      if (lastWrongAt !== null && startedAt > lastWrongAt) {
        item.reviewedAfterWrong = true;
        if (answer.isCorrect) item.correctRoundsAfterWrong += 1;
      }
      evidence.set(answer.questionId, item);
    });
  });

  return { seenIds, evidence, lastReviewedAt };
}

function collectRecentDictationBonuses(state: ReviewState, bank: Question[], now: number, recentStart: number): Map<number, number> {
  if (state.learningRecords) {
    return new Map(state.learningRecords.questions.map((record) => [record.questionId, record.recentErrors.reduce((total, day) => {
      const answeredAt = validPastTime(day.lastAnsweredAt, now);
      return answeredAt !== null && answeredAt >= recentStart
        ? total + day.meaning * RECENT_MEANING_ERROR_WEIGHT + day.spelling * RECENT_SPELLING_ERROR_WEIGHT : total;
    }, 0)]));
  }
  const bonuses = new Map<string, number>();
  const historyById = new Map(state.dictationHistory.map((entry) => [entry.id, entry]));
  historyById.forEach((entry) => {
    const finishedAt = validPastTime(entry.finishedAt, now);
    if (finishedAt === null || finishedAt < recentStart) return;
    entry.wrongWords.forEach((item) => {
      const word = item.word.trim().toLowerCase();
      const bonus = Math.max(0, item.meaningWrongCount) * RECENT_MEANING_ERROR_WEIGHT
        + Math.max(0, item.spellingWrongCount) * RECENT_SPELLING_ERROR_WEIGHT;
      bonuses.set(word, (bonuses.get(word) ?? 0) + bonus);
    });
  });
  return new Map(bank.map((question) => [question.id, bonuses.get(question.prompt.trim().toLowerCase()) ?? 0]));
}

function getTaskEvidence(state: ReviewState, now: number): { taskIds: Set<number>; dueIds: Set<number> } {
  const taskIds = new Set<number>();
  const dueIds = new Set<number>();
  state.reviewTasks.forEach((task) => {
    task.questionIds.forEach((id) => taskIds.add(id));
    if (validPastTime(task.dueAt, now) === null) return;
    getPendingReviewQuestionIds(task).forEach((id) => dueIds.add(id));
  });
  return { taskIds, dueIds };
}

function isWeekOld(wrong: WrongItem, now: number): boolean {
  const lastWrongAt = validPastTime(wrong.lastWrongAt, now);
  return lastWrongAt !== null && localDayNumber(now) - localDayNumber(lastWrongAt) >= RECENT_WINDOW_DAYS;
}

function focusWeight(
  wrong: WrongItem,
  practice: PracticeEvidence | undefined,
  dictationBonus: number,
  isDue: boolean,
  now: number,
): number {
  const cumulative = Math.min(CUMULATIVE_ERROR_LIMIT, wrong.wrongCount) * CUMULATIVE_ERROR_WEIGHT;
  const recent = Math.min(RECENT_ERROR_BONUS_LIMIT, (practice?.recentErrors ?? 0) * RECENT_PRACTICE_ERROR_WEIGHT + dictationBonus);
  const overdue = isDue ? DUE_REVIEW_BONUS : 0;
  const unreviewed = isWeekOld(wrong, now) && !practice?.reviewedAfterWrong ? WEEK_OLD_UNREVIEWED_BONUS : 0;
  const correctDiscount = Math.min(CORRECT_ROUND_LIMIT, practice?.correctRoundsAfterWrong ?? 0) * CORRECT_ROUND_DISCOUNT;
  return cumulative + recent + overdue + unreviewed - correctDiscount;
}

export function selectReviewQuestions(
  bank: Question[],
  state: ReviewState,
  options: { kind: ReviewKind; now?: Date; count?: number },
): Question[] {
  const now = options.now ?? new Date();
  const nowTime = now.getTime();
  const recentStart = getRecentWindowStart(now);
  const uniqueBank = [...new Map(bank.map((question) => [question.id, question])).values()];
  const wrongById = new Map(state.wrongBook.map((wrong) => [wrong.questionId, wrong]));
  const { seenIds, evidence, lastReviewedAt } = collectPracticeEvidence(state, wrongById, nowTime, recentStart);
  const dictationBonuses = collectRecentDictationBonuses(state, uniqueBank, nowTime, recentStart);
  const { taskIds, dueIds } = getTaskEvidence(state, nowTime);
  const isPendingWrong = (id: number) => {
    const wrong = wrongById.get(id);
    return Boolean(wrong && !wrong.mastered && wrong.wrongCount > 0);
  };
  const isSpacedFocus = (id: number) => {
    const wrong = wrongById.get(id);
    return dueIds.has(id) || Boolean(wrong && !taskIds.has(id) && isWeekOld(wrong, nowTime));
  };
  const isOld = (question: Question) => question.tags.includes('archived-dictation') || seenIds.has(question.id);
  const candidates = uniqueBank.filter((question) => {
    if (options.kind === 'weekly') {
      return isOld(question) || wrongById.has(question.id) || taskIds.has(question.id);
    }
    if (options.kind === 'spaced') {
      if (isPendingWrong(question.id)) return isSpacedFocus(question.id);
      return isOld(question) || dueIds.has(question.id);
    }
    return true;
  });

  const count = Math.min(Math.max(0, Math.floor(options.count ?? PRACTICE_SESSION_QUESTION_COUNT)), candidates.length);
  const seededOrder = pickDailyQuestions(candidates, candidates.length, now);
  const seedRank = new Map(seededOrder.map((question, index) => [question.id, index]));
  const compareSeed = (a: Question, b: Question) => seedRank.get(a.id)! - seedRank.get(b.id)!;
  const focus = candidates.filter((question) => isPendingWrong(question.id)).sort((a, b) => {
    const score = (question: Question) => focusWeight(
      wrongById.get(question.id)!,
      evidence.get(question.id),
      dictationBonuses.get(question.id) ?? 0,
      dueIds.has(question.id),
      nowTime,
    );
    return score(b) - score(a) || compareSeed(a, b);
  });
  const normal = candidates.filter((question) => !isPendingWrong(question.id)).sort((a, b) => {
    // 每日 10 题 keeps archived lessons ahead of other studied words; the other review entries treat every old word alike.
    const archivedPriority = options.kind === 'daily' ? 2 : 1;
    const priority = (question: Question) => question.tags.includes('archived-dictation') ? archivedPriority : isOld(question) ? 1 : 0;
    // Within a tier the word reviewed longest ago goes first (never-reviewed ones before all), so old words take
    // turns instead of the same ten coming back every day. The daily seed only breaks ties.
    const reviewedAt = (question: Question) => lastReviewedAt.get(question.id) ?? 0;
    return priority(b) - priority(a) || reviewedAt(a) - reviewedAt(b) || compareSeed(a, b);
  });
  const focusCount = options.kind === 'wrongFirst' ? count : Math.ceil(count * REVIEW_FOCUS_RATIO);
  const chosenFocus = focus.slice(0, focusCount);
  const chosenNormal = normal.slice(0, count - chosenFocus.length);
  const remaining = count - chosenFocus.length - chosenNormal.length;
  return [...chosenFocus, ...chosenNormal, ...focus.slice(chosenFocus.length, chosenFocus.length + remaining)];
}

// Picks the words reviewed longest ago (never-reviewed ones first) so a lesson larger than one round is fully covered over a few rounds.
export function pickLeastRecentlyReviewed(
  bank: Question[],
  state: ReviewState,
  options: { now?: Date; count?: number } = {},
): Question[] {
  const now = options.now ?? new Date();
  const uniqueBank = [...new Map(bank.map((question) => [question.id, question])).values()];
  const { lastReviewedAt } = collectPracticeEvidence(state, new Map(), now.getTime(), getRecentWindowStart(now));
  const seedRank = new Map(pickDailyQuestions(uniqueBank, uniqueBank.length, now).map((question, index) => [question.id, index]));
  const count = Math.min(Math.max(0, Math.floor(options.count ?? PRACTICE_SESSION_QUESTION_COUNT)), uniqueBank.length);
  return uniqueBank
    .sort((a, b) => (lastReviewedAt.get(a.id) ?? 0) - (lastReviewedAt.get(b.id) ?? 0) || seedRank.get(a.id)! - seedRank.get(b.id)!)
    .slice(0, count);
}
