import { recordCompletedTraining } from './learningRecords';
import type { AppState, StudySession } from '../types/schema';

const RECENT_SESSION_LIMIT = 30;

// True once every question of the round has a saved answer. Submitted answers are locked, so nothing can change after that.
export function isPracticeRoundFullyAnswered(
  questionIds: readonly number[],
  session: Pick<StudySession, 'answers'>,
): boolean {
  if (questionIds.length === 0) return false;
  const answeredIds = new Set(session.answers.map((answer) => answer.questionId));
  return questionIds.every((questionId) => answeredIds.has(questionId));
}

interface FinishPracticeRoundOptions {
  train: string;
  mode: StudySession['mode'];
  title: string;
  questionTotal: number;
  /** Keep the finished round as the active session so its last card can still be looked at. */
  keepActive: boolean;
  now?: Date;
}

// Records a finished practice round. It is called when the last open question gets its answer and again when
// "查看结果" is tapped; the second call adds no round, star or review-task progress.
export function finishPracticeRound(state: AppState, session: StudySession, options: FinishPracticeRoundOptions): AppState {
  const finishedAt = session.finishedAt ?? (options.now ?? new Date()).toISOString();
  const finishedSession: StudySession = { ...session, finishedAt };
  return recordCompletedTraining(
    {
      ...state,
      activeSession: options.keepActive ? finishedSession : null,
      sessions: [finishedSession, ...state.sessions.filter((item) => item.id !== finishedSession.id)].slice(0, RECENT_SESSION_LIMIT),
    },
    {
      id: session.id,
      source: 'practice',
      train: options.train,
      mode: options.mode,
      title: options.title,
      startedAt: session.startedAt,
      finishedAt,
      questionTotal: session.questionTotal ?? options.questionTotal,
      answers: session.answers.map((answer) => ({ ...answer, kind: 'practice' as const })),
    },
  );
}
