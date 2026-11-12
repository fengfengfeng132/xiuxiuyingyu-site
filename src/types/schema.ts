export type QuestionType = 'single_choice' | 'listen_choice' | 'spell' | 'vocab' | 'dialogue';

export interface ExampleSentence {
  text: string;
  translation: string;
  audioKey: string;
  source?: string;
}

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
  audioKey?: string;
  phonetic?: string;
  grammarLabel?: string;
  examples?: ExampleSentence[];
  partOfSpeech?: string;
  sources?: string[];
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
  reviewTaskId?: string;
  questionTotal?: number;
  questionIds?: number[];
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

export interface DictationHistoryWord {
  word: string;
  meaning: string;
  meaningWrongCount: number;
  spellingWrongCount: number;
}

export interface DictationHistoryEntry {
  id: string;
  finishedAt: string;
  wrongWords: DictationHistoryWord[];
}

export interface DictationWeeklyWordSummary {
  word: string;
  meaning: string;
  totalWrongCount: number;
  meaningWrongCount: number;
  spellingWrongCount: number;
  primaryWeakness: 'meaning' | 'spelling' | 'both';
}

export interface ReviewTask {
  id: string;
  questionIds: number[];
  completedQuestionIds?: number[];
  dueAt: string;
  completed: boolean;
}

export interface StarRecord {
  id: string;
  earnedAt: string;
  sourceType: 'practice' | 'dictation';
  sourceId: string;
  title: string;
  score: number;
  total: number;
}

export type TrainingSource = 'practice' | 'dictation';
export type TrainingAnswerKind = 'practice' | 'meaning' | 'spelling';

export interface TrainingAnswer {
  questionId: number;
  isCorrect: boolean;
  answeredAt: string;
  kind: TrainingAnswerKind;
}

export interface CompletedTrainingInput {
  id: string;
  source: TrainingSource;
  title: string;
  train?: string;
  mode?: StudySession['mode'];
  startedAt: string;
  finishedAt: string;
  questionTotal: number;
  answers: TrainingAnswer[];
}

export interface CompletedTrainingSummary {
  id: string;
  source: TrainingSource;
  title: string;
  train?: string;
  mode?: StudySession['mode'];
  startedAt?: string;
  finishedAt: string;
  questionTotal?: number;
  answeredCount: number;
  correctCount?: number;
  totalsKnown: boolean;
  durationSeconds?: number;
  questionIds: number[];
}

export interface LearningErrorDay {
  day: string;
  practice: number;
  meaning: number;
  spelling: number;
  lastAnsweredAt: string;
}

export interface CorrectTrainingRound {
  roundKey: string;
  startedAt: string;
  answeredAt: string;
}

export interface QuestionLearningRecord {
  questionId: number;
  firstSeenAt: string;
  lastReviewedAt: string;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  lastWrongAt?: string;
  recentErrors: LearningErrorDay[];
  correctRounds: CorrectTrainingRound[];
}

export interface LearningRecords {
  version: 1;
  rounds: CompletedTrainingSummary[];
  questions: QuestionLearningRecord[];
}

export interface AppState {
  activeSession: StudySession | null;
  sessions: StudySession[];
  wrongBook: WrongItem[];
  dictationHistory: DictationHistoryEntry[];
  reviewTasks: ReviewTask[];
  starRecords: StarRecord[];
  localAudioFiles: Record<string, string>;
  learningRecords?: LearningRecords;
}
