import type { ReviewTask } from '../types/schema';

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number');
}

export function isReviewTask(value: unknown): value is ReviewTask {
  if (!value || typeof value !== 'object') return false;
  const task = value as Record<string, unknown>;

  return (
    typeof task.id === 'string' &&
    isNumberArray(task.questionIds) &&
    typeof task.dueAt === 'string' &&
    typeof task.completed === 'boolean'
  );
}

export function parseReviewTasks(value: unknown): ReviewTask[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isReviewTask);
}
