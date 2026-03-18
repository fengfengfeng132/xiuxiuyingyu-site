import type { Question, QuestionType } from '../types/schema';

const QUESTION_TYPES = new Set(['single_choice', 'listen_choice', 'spell', 'vocab', 'dialogue']);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function normalizeType(rawType: unknown): QuestionType | null {
  if (rawType === '对话') return 'dialogue';
  if (typeof rawType !== 'string') return null;
  if (!QUESTION_TYPES.has(rawType)) return null;
  return rawType as QuestionType;
}

function normalizeQuestion(value: unknown): Question | null {
  if (!value || typeof value !== 'object') return null;

  const q = value as Record<string, unknown>;
  const type = normalizeType(q.type);

  const stemCandidate = typeof q.stem === 'string' ? q.stem : typeof q.content === 'string' ? q.content : '';
  const options = isStringArray(q.options) ? q.options : [];
  const answerIndex = typeof q.answerIndex === 'number' ? q.answerIndex : -1;

  if (
    typeof q.id !== 'number' ||
    q.level !== 'L2' ||
    typeof q.unit !== 'number' ||
    !type ||
    typeof q.prompt !== 'string' ||
    typeof stemCandidate !== 'string' ||
    !isStringArray(q.tags) ||
    typeof q.explanation !== 'string' ||
    (q.audioText !== undefined && typeof q.audioText !== 'string')
  ) {
    return null;
  }

  return {
    id: q.id,
    level: 'L2',
    unit: q.unit,
    type,
    prompt: q.prompt,
    stem: stemCandidate,
    options,
    answerIndex,
    explanation: q.explanation,
    tags: q.tags,
    audioText: typeof q.audioText === 'string' ? q.audioText : undefined,
  };
}

export function parseQuestionBank(value: unknown): Question[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeQuestion).filter((q): q is Question => Boolean(q));
}
