export type QuestionType = 'single_choice' | 'listen_choice' | 'spell' | 'vocab' | 'dialogue';

export interface Question {
  id: number;
  level: 'L2';
  unit: number;
  type: QuestionType;
  prompt: string;
  stem: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  tags: string[];
  audioText?: string;
}

export interface SessionAnswer {
  questionId: number;
  selectedIndex: number;
  isCorrect: boolean;
  answeredAt: string;
}

export interface StudySession {
  id: string;
  startedAt: string;
  finishedAt?: string;
  mode?: 'all' | 'vocab' | 'dialogue';
  train?: string;
  questionTotal?: number;
  currentQuestionIndex: number;
  answers: SessionAnswer[];
  score: number;
  accuracy: number;
}

export interface WrongItem {
  questionId: number;
  wrongCount: number;
  lastWrongAt: string;
  mastered: boolean;
}

export interface ReviewTask {
  id: string;
  questionIds: number[];
  dueAt: string;
  completed: boolean;
}

export interface AppState {
  activeSession: StudySession | null;
  sessions: StudySession[];
  wrongBook: WrongItem[];
  reviewTasks: ReviewTask[];
  localAudioFiles: Record<string, string>;
}
