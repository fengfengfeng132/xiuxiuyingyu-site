import type {
  AppState, CompletedTrainingInput, CompletedTrainingSummary, CorrectTrainingRound,
  LearningErrorDay, LearningRecords, Question, QuestionLearningRecord, SessionAnswer, TrainingAnswer,
} from '../types/schema';
import { getLocalDaySeed } from './practiceUtils';
import { applyReviewAnswers } from './reviewProgress';
import { awardPerfectTrainingStar } from './starRewards';

const RECENT_ERROR_DAYS = 7;
const CORRECT_ROUND_LIMIT = 3;

export function createLearningRecords(): LearningRecords {
  return { version: 1, rounds: [], questions: [] };
}

function time(value: string | undefined): number {
  return value === undefined ? NaN : Date.parse(value);
}

function earliest(a: string, b: string): string {
  return time(a) <= time(b) ? a : b;
}

function latest(a: string, b: string): string {
  return time(a) >= time(b) ? a : b;
}

function roundKey(source: string, id: string): string {
  return `${source}:${id}`;
}

function newQuestion(questionId: number, answeredAt: string): QuestionLearningRecord {
  return {
    questionId, firstSeenAt: answeredAt, lastReviewedAt: answeredAt,
    answeredCount: 0, correctCount: 0, wrongCount: 0, recentErrors: [], correctRounds: [],
  };
}

function mergeRecentErrors(entries: LearningErrorDay[], referenceTime: string): LearningErrorDay[] {
  const start = new Date(referenceTime);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (RECENT_ERROR_DAYS - 1));
  const firstDay = getLocalDaySeed(start);
  const merged = new Map<string, LearningErrorDay>();
  entries.forEach((entry) => {
    if (entry.day < firstDay) return;
    const previous = merged.get(entry.day);
    merged.set(entry.day, previous ? {
      day: entry.day,
      practice: previous.practice + entry.practice,
      meaning: previous.meaning + entry.meaning,
      spelling: previous.spelling + entry.spelling,
      lastAnsweredAt: latest(previous.lastAnsweredAt, entry.lastAnsweredAt),
    } : { ...entry });
  });
  return [...merged.values()].sort((a, b) => a.day.localeCompare(b.day));
}

function keepCorrectRounds(rounds: CorrectTrainingRound[], lastWrongAt?: string): CorrectTrainingRound[] {
  const unique = [...new Map(rounds.map((round) => [round.roundKey, round])).values()];
  return unique
    .filter((round) => lastWrongAt === undefined || time(round.startedAt) > time(lastWrongAt))
    .sort((a, b) => time(b.answeredAt) - time(a.answeredAt))
    .slice(0, CORRECT_ROUND_LIMIT);
}

export function mergeQuestionLearningRecords(records: QuestionLearningRecord[]): QuestionLearningRecord[] {
  const merged = new Map<number, QuestionLearningRecord>();
  records.forEach((record) => {
    const previous = merged.get(record.questionId);
    if (!previous) {
      merged.set(record.questionId, record);
      return;
    }
    const lastReviewedAt = latest(previous.lastReviewedAt, record.lastReviewedAt);
    const lastWrongAt = previous.lastWrongAt && record.lastWrongAt
      ? latest(previous.lastWrongAt, record.lastWrongAt) : previous.lastWrongAt ?? record.lastWrongAt;
    merged.set(record.questionId, {
      questionId: record.questionId,
      firstSeenAt: earliest(previous.firstSeenAt, record.firstSeenAt),
      lastReviewedAt,
      answeredCount: previous.answeredCount + record.answeredCount,
      correctCount: previous.correctCount + record.correctCount,
      wrongCount: previous.wrongCount + record.wrongCount,
      ...(lastWrongAt ? { lastWrongAt } : {}),
      recentErrors: mergeRecentErrors([...previous.recentErrors, ...record.recentErrors], lastReviewedAt),
      correctRounds: keepCorrectRounds([...previous.correctRounds, ...record.correctRounds], lastWrongAt),
    });
  });
  return [...merged.values()];
}

function recordQuestion(
  previous: QuestionLearningRecord | undefined,
  answers: TrainingAnswer[],
  input: Pick<CompletedTrainingInput, 'id' | 'source' | 'startedAt' | 'finishedAt'>,
): QuestionLearningRecord {
  const firstAnswer = answers.reduce((first, answer) => earliest(first, answer.answeredAt), answers[0].answeredAt);
  const lastAnswer = answers.reduce((last, answer) => latest(last, answer.answeredAt), answers[0].answeredAt);
  const record = previous ?? newQuestion(answers[0].questionId, firstAnswer);
  const mistakes = answers.filter((answer) => !answer.isCorrect);
  const lastWrongAt = mistakes.reduce<string | undefined>((last, answer) => last ? latest(last, answer.answeredAt) : answer.answeredAt, record.lastWrongAt);
  const recent = mistakes.map((answer): LearningErrorDay => ({
    day: getLocalDaySeed(new Date(answer.answeredAt)),
    practice: answer.kind === 'practice' ? 1 : 0,
    meaning: answer.kind === 'meaning' ? 1 : 0,
    spelling: answer.kind === 'spelling' ? 1 : 0,
    lastAnsweredAt: answer.answeredAt,
  }));
  const allPartsCorrect = mistakes.length === 0 && (input.source === 'practice'
    || (answers.some((answer) => answer.kind === 'meaning') && answers.some((answer) => answer.kind === 'spelling')));
  const correctRounds = allPartsCorrect ? [...record.correctRounds, {
    roundKey: roundKey(input.source, input.id), startedAt: input.startedAt, answeredAt: lastAnswer,
  }] : record.correctRounds;
  const lastReviewedAt = latest(record.lastReviewedAt, lastAnswer);
  return {
    ...record,
    firstSeenAt: earliest(record.firstSeenAt, firstAnswer), lastReviewedAt,
    answeredCount: record.answeredCount + answers.length,
    correctCount: record.correctCount + answers.length - mistakes.length,
    wrongCount: record.wrongCount + mistakes.length,
    ...(lastWrongAt ? { lastWrongAt } : {}),
    recentErrors: mergeRecentErrors([...record.recentErrors, ...recent], latest(lastReviewedAt, input.finishedAt)),
    correctRounds: keepCorrectRounds(correctRounds, lastWrongAt),
  };
}

function groupAnswers(answers: TrainingAnswer[], deduplicate = true): Map<number, TrainingAnswer[]> {
  const byAttempt = new Map<string, TrainingAnswer>();
  answers.forEach((answer) => {
    const key = `${answer.questionId}:${answer.kind}`;
    const previous = byAttempt.get(key);
    if (!previous || time(answer.answeredAt) >= time(previous.answeredAt)) byAttempt.set(key, answer);
  });
  const grouped = new Map<number, TrainingAnswer[]>();
  const attempts = deduplicate ? [...byAttempt.values()] : answers;
  attempts.forEach((answer) => grouped.set(answer.questionId, [...(grouped.get(answer.questionId) ?? []), answer]));
  return grouped;
}

function taskAnswers(grouped: Map<number, TrainingAnswer[]>, source: CompletedTrainingInput['source']): SessionAnswer[] {
  return [...grouped].flatMap(([questionId, answers]) => {
    const mistakes = answers.filter((answer) => !answer.isCorrect);
    const allPartsPresent = source === 'practice'
      || (answers.some((answer) => answer.kind === 'meaning') && answers.some((answer) => answer.kind === 'spelling'));
    if (!allPartsPresent && mistakes.length === 0) return [];
    // A composite correct result counts only when every assessed part happened after a task was due.
    const answeredAt = mistakes.length
      ? mistakes.reduce((last, answer) => latest(last, answer.answeredAt), mistakes[0].answeredAt)
      : answers.reduce((first, answer) => earliest(first, answer.answeredAt), answers[0].answeredAt);
    return [{ questionId, selectedIndex: 0, isCorrect: mistakes.length === 0, answeredAt }];
  });
}

function validateCompletedTraining(input: CompletedTrainingInput): void {
  const startedAt = time(input.startedAt);
  const finishedAt = time(input.finishedAt);
  if (!input.id || !['practice', 'dictation'].includes(input.source)
    || !Number.isFinite(startedAt) || !Number.isFinite(finishedAt) || finishedAt < startedAt
    || !Number.isSafeInteger(input.questionTotal) || input.questionTotal < 1) {
    throw new Error('Completed training has invalid identity, time range or question total.');
  }
  input.answers.forEach((answer) => {
    const answeredAt = time(answer.answeredAt);
    if (!Number.isSafeInteger(answer.questionId) || answer.questionId < 1
      || !['practice', 'meaning', 'spelling'].includes(answer.kind)
      || (input.source === 'practice' ? answer.kind !== 'practice' : answer.kind === 'practice')
      || typeof answer.isCorrect !== 'boolean' || !Number.isFinite(answeredAt)
      || answeredAt < startedAt || answeredAt > finishedAt) {
      throw new Error(`Completed training has an invalid answer: ${answer.questionId}`);
    }
  });
}

export function recordCompletedTraining(state: AppState, input: CompletedTrainingInput): AppState {
  validateCompletedTraining(input);
  const key = roundKey(input.source, input.id);
  const records = state.learningRecords ?? backfillRecords(state, [], key);
  if (records.rounds.some((round) => roundKey(round.source, round.id) === key)) return state;

  const grouped = groupAnswers(input.answers);
  const answers = [...grouped.values()].flat();
  if (answers.length > input.questionTotal) throw new Error('Completed training has more answers than its question total.');
  const questionsById = new Map(records.questions.map((record) => [record.questionId, record]));
  grouped.forEach((attempts, questionId) => questionsById.set(questionId, recordQuestion(questionsById.get(questionId), attempts, input)));
  const summary: CompletedTrainingSummary = {
    id: input.id, source: input.source, title: input.title, train: input.train, mode: input.mode,
    startedAt: input.startedAt, finishedAt: input.finishedAt, questionTotal: input.questionTotal,
    answeredCount: answers.length, correctCount: answers.filter((answer) => answer.isCorrect).length,
    totalsKnown: true, durationSeconds: (time(input.finishedAt) - time(input.startedAt)) / 1000,
    questionIds: [...grouped.keys()],
  };
  const nextState: AppState = {
    ...state,
    learningRecords: { version: 1, rounds: [summary, ...records.rounds], questions: [...questionsById.values()] },
    reviewTasks: applyReviewAnswers(state.reviewTasks, taskAnswers(grouped, input.source), new Date(input.finishedAt)),
  };
  return awardPerfectTrainingStar(nextState, {
    sourceType: input.source, sourceId: input.id, title: input.title,
    score: summary.correctCount!, total: input.questionTotal, earnedAt: input.finishedAt,
  }).state;
}

function backfillRecords(state: AppState, bank: readonly Pick<Question, 'id' | 'prompt'>[], excludedKey?: string): LearningRecords {
  let records = createLearningRecords();
  const recordedKeys = new Set<string>();
  const byWord = new Map(bank.map((question) => [question.prompt.trim().toLowerCase(), question.id]));

  const addKnownQuestion = (questionId: number, answeredAt: string) => {
    if (!Number.isFinite(time(answeredAt))) return;
    if (!records.questions.some((question) => question.questionId === questionId)) records.questions.push(newQuestion(questionId, answeredAt));
  };

  state.sessions.forEach((session) => {
    const key = roundKey('practice', session.id);
    if (key === excludedKey || recordedKeys.has(key)) return;
    const validAnswers = session.answers.filter((answer) => Number.isFinite(time(answer.answeredAt)));
    validAnswers.forEach((answer) => addKnownQuestion(answer.questionId, answer.answeredAt));
    if (!Number.isFinite(time(session.finishedAt)) || !Number.isFinite(time(session.startedAt))
      || time(session.finishedAt) < time(session.startedAt)) return;
    const answers = validAnswers.filter((answer) => time(answer.answeredAt) >= time(session.startedAt)
      && time(answer.answeredAt) <= time(session.finishedAt)).map((answer): TrainingAnswer => ({ ...answer, kind: 'practice' }));
    // Aliases may merge two formerly distinct questions; those historical attempts remain real answers.
    const grouped = groupAnswers(answers, false);
    const questionById = new Map(records.questions.map((question) => [question.questionId, question]));
    grouped.forEach((attempts, questionId) => questionById.set(questionId, recordQuestion(questionById.get(questionId), attempts, {
      id: session.id, source: 'practice', startedAt: session.startedAt, finishedAt: session.finishedAt!,
    })));
    const totalKnown = Number.isSafeInteger(session.questionTotal) && session.questionTotal! >= answers.length;
    const correctCount = Number.isSafeInteger(session.score) && session.score >= 0 && session.score <= answers.length
      ? session.score : answers.filter((answer) => answer.isCorrect).length;
    records = {
      ...records, questions: [...questionById.values()], rounds: [...records.rounds, {
        id: session.id, source: 'practice', title: session.train ?? '历史练习', train: session.train, mode: session.mode,
        startedAt: session.startedAt, finishedAt: session.finishedAt!, questionTotal: totalKnown ? session.questionTotal : undefined,
        answeredCount: answers.length, correctCount,
        totalsKnown: totalKnown, durationSeconds: (time(session.finishedAt) - time(session.startedAt)) / 1000,
        questionIds: [...grouped.keys()],
      }],
    };
    recordedKeys.add(key);
  });

  state.dictationHistory.forEach((entry) => {
    const key = roundKey('dictation', entry.id);
    if (key === excludedKey || recordedKeys.has(key) || !Number.isFinite(time(entry.finishedAt))) return;
    const questionIds: number[] = [];
    let answeredCount = 0;
    const questionById = new Map(records.questions.map((question) => [question.questionId, question]));
    entry.wrongWords.forEach((word) => {
      answeredCount += word.meaningWrongCount + word.spellingWrongCount;
      const questionId = byWord.get(word.word.trim().toLowerCase());
      if (questionId === undefined) return;
      questionIds.push(questionId);
      const previous = questionById.get(questionId) ?? newQuestion(questionId, entry.finishedAt);
      const mistakes = word.meaningWrongCount + word.spellingWrongCount;
      const lastReviewedAt = latest(previous.lastReviewedAt, entry.finishedAt);
      const lastWrongAt = previous.lastWrongAt ? latest(previous.lastWrongAt, entry.finishedAt) : entry.finishedAt;
      questionById.set(questionId, {
        ...previous, firstSeenAt: earliest(previous.firstSeenAt, entry.finishedAt), lastReviewedAt, lastWrongAt,
        answeredCount: previous.answeredCount + mistakes, wrongCount: previous.wrongCount + mistakes,
        recentErrors: mergeRecentErrors([...previous.recentErrors, {
          day: getLocalDaySeed(new Date(entry.finishedAt)), practice: 0,
          meaning: word.meaningWrongCount, spelling: word.spellingWrongCount, lastAnsweredAt: entry.finishedAt,
        }], lastReviewedAt),
        correctRounds: keepCorrectRounds(previous.correctRounds, lastWrongAt),
      });
    });
    records.questions = [...questionById.values()];
    records.rounds.push({ id: entry.id, source: 'dictation', title: '历史听写', train: 'dictation', mode: 'vocab',
      finishedAt: entry.finishedAt, answeredCount, totalsKnown: false, questionIds: [...new Set(questionIds)] });
    recordedKeys.add(key);
  });

  state.starRecords.forEach((star) => {
    const key = roundKey(star.sourceType, star.sourceId);
    if (key === excludedKey || !Number.isFinite(time(star.earnedAt))
      || !isCount(star.total) || star.total < 1 || !isCount(star.score) || star.score > star.total) return;
    if (recordedKeys.has(key)) {
      records.rounds = records.rounds.map((round) => roundKey(round.source, round.id) === key && !round.totalsKnown
        ? { ...round, questionTotal: star.total, answeredCount: star.total, correctCount: star.score, totalsKnown: true } : round);
      return;
    }
    records.rounds.push({ id: star.sourceId, source: star.sourceType, title: star.title,
      finishedAt: star.earnedAt, questionTotal: star.total, answeredCount: star.total,
      correctCount: star.score, totalsKnown: true, questionIds: [] });
    recordedKeys.add(key);
  });
  state.wrongBook.forEach((wrong) => addKnownQuestion(wrong.questionId, wrong.lastWrongAt));
  return records;
}

// The storage boundary supplies the bank once so legacy word-only mistakes can resolve to stable question IDs.
export function ensureLearningRecords(state: AppState, bank: readonly Pick<Question, 'id' | 'prompt'>[] = []): AppState {
  return state.learningRecords ? state : { ...state, learningRecords: backfillRecords(state, bank) };
}

export function getLearningRecords(state: AppState, bank: readonly Pick<Question, 'id' | 'prompt'>[] = []): LearningRecords {
  return state.learningRecords ?? backfillRecords(state, bank);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isTime(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(time(value));
}

function isRoundSummary(value: unknown): value is CompletedTrainingSummary {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && value.id.length > 0
    && (value.source === 'practice' || value.source === 'dictation') && typeof value.title === 'string'
    && (value.train === undefined || typeof value.train === 'string')
    && (value.mode === undefined || ['all', 'vocab', 'dialogue'].includes(value.mode as string))
    && isTime(value.finishedAt) && (value.startedAt === undefined || (isTime(value.startedAt) && time(value.startedAt) <= time(value.finishedAt)))
    && (value.questionTotal === undefined || isCount(value.questionTotal))
    && isCount(value.answeredCount) && typeof value.totalsKnown === 'boolean'
    && (value.correctCount === undefined || (isCount(value.correctCount) && value.correctCount <= value.answeredCount))
    && (!value.totalsKnown || isCount(value.correctCount))
    && (value.durationSeconds === undefined || (typeof value.durationSeconds === 'number' && Number.isFinite(value.durationSeconds) && value.durationSeconds >= 0))
    && Array.isArray(value.questionIds) && value.questionIds.every((id) => Number.isSafeInteger(id) && id > 0);
}

function isErrorDay(value: unknown): value is LearningErrorDay {
  if (!isRecord(value) || typeof value.day !== 'string' || !isTime(value.lastAnsweredAt)) return false;
  return getLocalDaySeed(new Date(value.lastAnsweredAt)) === value.day
    && isCount(value.practice) && isCount(value.meaning) && isCount(value.spelling);
}

function isCorrectRound(value: unknown): value is CorrectTrainingRound {
  return isRecord(value) && typeof value.roundKey === 'string' && isTime(value.startedAt)
    && isTime(value.answeredAt) && time(value.startedAt) <= time(value.answeredAt);
}

function isQuestionRecord(value: unknown): value is QuestionLearningRecord {
  if (!isRecord(value)) return false;
  return Number.isSafeInteger(value.questionId) && (value.questionId as number) > 0
    && isTime(value.firstSeenAt) && isTime(value.lastReviewedAt)
    && time(value.firstSeenAt) <= time(value.lastReviewedAt)
    && isCount(value.answeredCount) && isCount(value.correctCount) && isCount(value.wrongCount)
    && value.correctCount + value.wrongCount === value.answeredCount
    && (value.lastWrongAt === undefined || isTime(value.lastWrongAt))
    && Array.isArray(value.recentErrors) && value.recentErrors.every(isErrorDay)
    && Array.isArray(value.correctRounds) && value.correctRounds.every(isCorrectRound);
}

export function parseLearningRecords(value: unknown): LearningRecords | undefined {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.rounds) || !Array.isArray(value.questions)) return undefined;
  const rounds = [...new Map(value.rounds.filter(isRoundSummary).map((round) => [roundKey(round.source, round.id), {
    ...round, questionIds: [...new Set(round.questionIds)],
  }])).values()];
  const questions = value.questions.filter(isQuestionRecord).map((record) => ({
    ...record, recentErrors: mergeRecentErrors(record.recentErrors, record.lastReviewedAt),
    correctRounds: keepCorrectRounds(record.correctRounds, record.lastWrongAt),
  }));
  return { version: 1, rounds, questions: mergeQuestionLearningRecords(questions) };
}

export function migrateLearningRecordsQuestionIds(records: LearningRecords, aliases: ReadonlyMap<number, number>): LearningRecords {
  const questions = records.questions.map((question) => {
    const questionId = aliases.get(question.questionId) ?? question.questionId;
    return questionId === question.questionId ? question : { ...question, questionId };
  });
  const rounds = records.rounds.map((round) => {
    const questionIds = [...new Set(round.questionIds.map((id) => aliases.get(id) ?? id))];
    return questionIds.length === round.questionIds.length && questionIds.every((id, index) => id === round.questionIds[index])
      ? round : { ...round, questionIds };
  });
  if (questions.every((question, index) => question === records.questions[index])
    && rounds.every((round, index) => round === records.rounds[index])) return records;
  return { ...records, questions: mergeQuestionLearningRecords(questions), rounds };
}
