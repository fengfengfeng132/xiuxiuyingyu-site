import type { AppState, ReviewTask, StudySession, WrongItem } from '../types/schema';
import { migrateLearningRecordsQuestionIds } from './learningRecords';

function migrateIdList(questionIds: number[], aliases: ReadonlyMap<number, number>): number[] {
  const migrated = [...new Set(questionIds.map((questionId) => aliases.get(questionId) ?? questionId))];
  return migrated.length === questionIds.length && migrated.every((questionId, index) => questionId === questionIds[index])
    ? questionIds
    : migrated;
}

function migrateSession(session: StudySession, aliases: ReadonlyMap<number, number>): StudySession {
  const answers = session.answers.map((answer) => {
    const questionId = aliases.get(answer.questionId) ?? answer.questionId;
    return questionId === answer.questionId ? answer : { ...answer, questionId };
  });
  const questionIds = session.questionIds ? migrateIdList(session.questionIds, aliases) : undefined;
  const answersChanged = answers.some((answer, index) => answer !== session.answers[index]);
  if (!answersChanged && questionIds === session.questionIds) return session;

  return {
    ...session,
    answers: answersChanged ? answers : session.answers,
    ...(questionIds ? { questionIds } : {}),
  };
}

function migrateWrongBook(items: WrongItem[], aliases: ReadonlyMap<number, number>): WrongItem[] {
  const merged = new Map<number, WrongItem>();
  let changed = false;

  items.forEach((item) => {
    const questionId = aliases.get(item.questionId) ?? item.questionId;
    const previous = merged.get(questionId);
    if (previous) {
      changed = true;
      merged.set(questionId, {
        questionId,
        wrongCount: previous.wrongCount + item.wrongCount,
        lastWrongAt: Date.parse(item.lastWrongAt) > Date.parse(previous.lastWrongAt) ? item.lastWrongAt : previous.lastWrongAt,
        mastered: previous.mastered && item.mastered,
      });
      return;
    }

    changed ||= questionId !== item.questionId;
    merged.set(questionId, questionId === item.questionId ? item : { ...item, questionId });
  });

  return changed ? [...merged.values()] : items;
}

function migrateReviewTask(task: ReviewTask, aliases: ReadonlyMap<number, number>): ReviewTask {
  const questionIds = migrateIdList(task.questionIds, aliases);
  const completedQuestionIds = task.completedQuestionIds ? migrateIdList(task.completedQuestionIds, aliases) : undefined;
  if (questionIds === task.questionIds && completedQuestionIds === task.completedQuestionIds) return task;

  const completedIds = new Set(completedQuestionIds ?? []);
  const completed = task.completed || (questionIds.length > 0 && questionIds.every((questionId) => completedIds.has(questionId)));
  return { ...task, questionIds, completed, ...(completedQuestionIds ? { completedQuestionIds } : {}) };
}

export function migrateQuestionIds(state: AppState, aliases: ReadonlyMap<number, number>): AppState {
  if (aliases.size === 0) return state;

  const activeSession = state.activeSession ? migrateSession(state.activeSession, aliases) : null;
  const sessions = state.sessions.map((session) => migrateSession(session, aliases));
  const wrongBook = migrateWrongBook(state.wrongBook, aliases);
  const reviewTasks = state.reviewTasks.map((task) => migrateReviewTask(task, aliases));
  const learningRecords = state.learningRecords ? migrateLearningRecordsQuestionIds(state.learningRecords, aliases) : undefined;
  const sessionsChanged = sessions.some((session, index) => session !== state.sessions[index]);
  const reviewTasksChanged = reviewTasks.some((task, index) => task !== state.reviewTasks[index]);

  if (activeSession === state.activeSession && wrongBook === state.wrongBook && !sessionsChanged && !reviewTasksChanged
    && learningRecords === state.learningRecords) {
    return state;
  }

  return {
    ...state,
    activeSession,
    sessions: sessionsChanged ? sessions : state.sessions,
    wrongBook,
    reviewTasks: reviewTasksChanged ? reviewTasks : state.reviewTasks,
    ...(learningRecords ? { learningRecords } : {}),
  };
}
