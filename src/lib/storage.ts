import type { AppState, StudySession } from '../types/schema';
import { parseAppState } from '../schema/studySchema';
import { questionBank, questionIdAliases } from '../data/loadQuestionBank';
import { migrateQuestionIds } from './questionIdMigration';
import { createLearningRecords, ensureLearningRecords } from './learningRecords';

const APP_STORAGE_KEY = 'woe_l2_local_state_v1';

export function createInitialState(): AppState {
  return {
    activeSession: null, sessions: [], wrongBook: [], dictationHistory: [],
    reviewTasks: [], starRecords: [], localAudioFiles: {}, learningRecords: createLearningRecords(),
  };
}

const initialState = createInitialState();

export function loadState(): AppState {
  let state: AppState;
  try {
    const raw = localStorage.getItem(APP_STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as unknown;
    state = parseAppState(parsed, createInitialState());
  } catch {
    return createInitialState();
  }
  return ensureLearningRecords(migrateQuestionIds(state, questionIdAliases), questionBank);
}

export function saveState(state: AppState): void {
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(state));
}

export function createSession(): StudySession {
  return {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    currentQuestionIndex: 0,
    answers: [],
    score: 0,
    accuracy: 0,
  };
}

export function startSession(): StudySession {
  const state = loadState();
  const session = createSession();
  state.activeSession = session;
  saveState(state);
  return session;
}

export function resetState(): void {
  localStorage.removeItem(APP_STORAGE_KEY);
}

export { initialState, APP_STORAGE_KEY };
