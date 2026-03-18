import type { WrongItem } from '../types/schema';

export function isWrongItem(value: unknown): value is WrongItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;

  return (
    typeof item.questionId === 'number' &&
    typeof item.wrongCount === 'number' &&
    typeof item.lastWrongAt === 'string' &&
    typeof item.mastered === 'boolean'
  );
}

export function parseWrongBook(value: unknown): WrongItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isWrongItem);
}
