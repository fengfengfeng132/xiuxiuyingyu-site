import type { AppState, DictationHistoryEntry, DictationHistoryWord, SessionAnswer, StarRecord, StudySession } from '../types/schema';
import { parseReviewTasks } from './reviewSchema';
import { parseWrongBook } from './wrongBookSchema';

function isSessionAnswer(value: unknown): value is SessionAnswer {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;

  return (
    typeof item.questionId === 'number' &&
    typeof item.selectedIndex === 'number' &&
    typeof item.isCorrect === 'boolean' &&
    typeof item.answeredAt === 'string'
  );
}

function normalizeMode(value: unknown): 'all' | 'vocab' | 'dialogue' | undefined {
  if (value === 'all' || value === 'vocab' || value === 'dialogue') return value;
  return undefined;
}

export function isStudySession(value: unknown): value is StudySession {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;

  return (
    typeof s.id === 'string' &&
    typeof s.startedAt === 'string' &&
    (s.finishedAt === undefined || typeof s.finishedAt === 'string') &&
    (s.mode === undefined || s.mode === 'all' || s.mode === 'vocab' || s.mode === 'dialogue') &&
    (s.train === undefined || typeof s.train === 'string') &&
    (s.questionTotal === undefined || typeof s.questionTotal === 'number') &&
    typeof s.currentQuestionIndex === 'number' &&
    Array.isArray(s.answers) &&
    s.answers.every(isSessionAnswer) &&
    typeof s.score === 'number' &&
    typeof s.accuracy === 'number'
  );
}

function parseSessions(value: unknown): StudySession[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isStudySession).map((session) => ({
    ...session,
    mode: normalizeMode(session.mode),
  }));
}

function isDictationHistoryWord(value: unknown): value is DictationHistoryWord {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;

  return (
    typeof item.word === 'string' &&
    typeof item.meaning === 'string' &&
    typeof item.meaningWrongCount === 'number' &&
    typeof item.spellingWrongCount === 'number'
  );
}

function isDictationHistoryEntry(value: unknown): value is DictationHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;

  return (
    typeof item.id === 'string' &&
    typeof item.finishedAt === 'string' &&
    Array.isArray(item.wrongWords) &&
    item.wrongWords.every(isDictationHistoryWord)
  );
}

function parseDictationHistory(value: unknown): DictationHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isDictationHistoryEntry);
}

function isStarRecord(value: unknown): value is StarRecord {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;

  return (
    typeof item.id === 'string' &&
    typeof item.earnedAt === 'string' &&
    (item.sourceType === 'practice' || item.sourceType === 'dictation') &&
    typeof item.sourceId === 'string' &&
    typeof item.title === 'string' &&
    typeof item.score === 'number' &&
    typeof item.total === 'number'
  );
}

function parseStarRecords(value: unknown): StarRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isStarRecord);
}

export function parseAppState(value: unknown, fallback: AppState): AppState {
  if (!value || typeof value !== 'object') return fallback;

  const raw = value as Record<string, unknown>;
  const activeSession = isStudySession(raw.activeSession)
    ? {
        ...raw.activeSession,
        mode: normalizeMode(raw.activeSession.mode),
      }
    : null;
  const sessions = parseSessions(raw.sessions);
  const wrongBook = parseWrongBook(raw.wrongBook);
  const dictationHistory = parseDictationHistory(raw.dictationHistory);
  const reviewTasks = parseReviewTasks(raw.reviewTasks);
  const starRecords = parseStarRecords(raw.starRecords);
  const localAudioFiles =
    raw.localAudioFiles && typeof raw.localAudioFiles === 'object' && !Array.isArray(raw.localAudioFiles)
      ? (raw.localAudioFiles as Record<string, string>)
      : {};

  return {
    ...fallback,
    activeSession,
    sessions,
    wrongBook,
    dictationHistory,
    reviewTasks,
    starRecords,
    localAudioFiles,
  };
}
