import type { AppState, StudySession } from '../types/schema';
import { parseAppState } from '../schema/studySchema';

const APP_STORAGE_KEY = 'woe_l2_local_state_v1';

const initialState: AppState = {
  activeSession: null,
  sessions: [],
  wrongBook: [],
  dictationHistory: [],
  reviewTasks: [],
  starRecords: [],
  localAudioFiles: {},
};

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(APP_STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as unknown;
    return parseAppState(parsed, initialState);
  } catch {
    return initialState;
  }
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
