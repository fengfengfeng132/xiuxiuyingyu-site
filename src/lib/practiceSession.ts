import { isQuestionIdArray } from '../schema/reviewSchema';
import type { Question, StudySession } from '../types/schema';

interface PracticeSessionScope {
  mode: 'all' | 'vocab' | 'dialogue';
  train: string;
  reviewTaskId?: string;
}

function matchesPracticeScope(session: StudySession | null, options: PracticeSessionScope): session is StudySession {
  return !!session && session.mode === options.mode && session.train === options.train
    && session.reviewTaskId === options.reviewTaskId;
}

export function getSavedPracticeQuestionIds(
  session: StudySession | null,
  bank: Question[],
  options: PracticeSessionScope,
): number[] | null {
  if (!matchesPracticeScope(session, options)) return null;

  const questionIds = session.questionIds;
  if (!isQuestionIdArray(questionIds) || questionIds.length === 0) return null;
  const savedIds = new Set(questionIds);
  if (savedIds.size !== questionIds.length) return null;

  const bankIds = new Set(bank.map((question) => question.id));
  if (!questionIds.every((questionId) => bankIds.has(questionId))) return null;
  if (!session.answers.every((answer) => savedIds.has(answer.questionId))) return null;

  return [...questionIds];
}

export function getLegacyPracticeQuestionIds(
  session: StudySession | null,
  bank: Question[],
  options: PracticeSessionScope,
): number[] | null {
  if (!matchesPracticeScope(session, options) || session.questionIds !== undefined) return null;
  const bankIds = new Set(bank.map((question) => question.id));
  const answeredIds = new Set(session.answers.map((answer) => answer.questionId));
  if (![...answeredIds].every((questionId) => bankIds.has(questionId))) return null;

  return [...answeredIds, ...[...bankIds].filter((questionId) => !answeredIds.has(questionId))];
}
