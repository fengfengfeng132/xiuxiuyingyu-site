import type { ReviewTask } from '../types/schema';

export function isQuestionIdArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => Number.isSafeInteger(item) && item > 0);
}

export function isReviewTask(value: unknown): value is ReviewTask {
  if (!value || typeof value !== 'object') return false;
  const task = value as Record<string, unknown>;

  return (
    typeof task.id === 'string' &&
    isQuestionIdArray(task.questionIds) &&
    (task.completedQuestionIds === undefined || (
      isQuestionIdArray(task.completedQuestionIds) &&
      task.completedQuestionIds.every((questionId) => (task.questionIds as number[]).includes(questionId))
    )) &&
    typeof task.dueAt === 'string' &&
    typeof task.completed === 'boolean'
  );
}

export function parseReviewTasks(value: unknown): ReviewTask[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isReviewTask).map((task) => (
    task.completedQuestionIds === undefined ? { ...task, completedQuestionIds: [] } : task
  ));
}
