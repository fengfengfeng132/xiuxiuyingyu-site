import { cloneReviewTasks, scheduleReviewTasks } from './practiceUtils';
import type { Question, ReviewTask, SessionAnswer, WrongItem } from '../types/schema';

export interface WrongWordReviewItem {
  questionId: number;
  prompt: string;
  meaning: string;
  wrongCount: number;
}

export const WRONG_ANSWER_TONE_PATTERN = [
  { frequency: 392, durationMs: 120 },
  { frequency: 262, durationMs: 180 },
] as const;

function extractMeaning(explanation: string): string {
  const parts = explanation.trim().split(/\s+/);
  return parts.length >= 2 ? parts.slice(1).join(' ') : explanation.trim();
}

export function findQuestionIdByPrompt(bank: Question[], prompt: string): number | null {
  const normalizedPrompt = prompt.trim().toLowerCase();
  const match = bank.find((item) => item.prompt.trim().toLowerCase() === normalizedPrompt);
  return match?.id ?? null;
}

export function collectWrongWordReviewItems(
  answers: SessionAnswer[],
  bank: Question[],
): WrongWordReviewItem[] {
  const reviewMap = new Map<number, WrongWordReviewItem>();

  answers.forEach((answer) => {
    if (answer.isCorrect) return;
    const question = bank.find((item) => item.id === answer.questionId);
    if (!question) return;

    const existing = reviewMap.get(question.id);
    if (existing) {
      existing.wrongCount += 1;
      return;
    }

    reviewMap.set(question.id, {
      questionId: question.id,
      prompt: question.prompt,
      meaning: extractMeaning(question.explanation),
      wrongCount: 1,
    });
  });

  return Array.from(reviewMap.values()).sort((a, b) => b.wrongCount - a.wrongCount || a.questionId - b.questionId);
}

export function updateWrongBookForQuestion(
  wrongBook: WrongItem[],
  reviewTasks: ReviewTask[],
  questionId: number,
  now: Date,
): {
  wrongBook: WrongItem[];
  reviewTasks: ReviewTask[];
} {
  const nextWrongBook = wrongBook.map((item) => ({ ...item }));
  const wrongIndex = nextWrongBook.findIndex((item) => item.questionId === questionId);

  if (wrongIndex >= 0) {
    nextWrongBook[wrongIndex] = {
      ...nextWrongBook[wrongIndex],
      wrongCount: nextWrongBook[wrongIndex].wrongCount + 1,
      lastWrongAt: now.toISOString(),
      mastered: false,
    };
  } else {
    nextWrongBook.push({
      questionId,
      wrongCount: 1,
      lastWrongAt: now.toISOString(),
      mastered: false,
    });
  }

  return {
    wrongBook: nextWrongBook,
    reviewTasks: scheduleReviewTasks(cloneReviewTasks(reviewTasks), questionId, now),
  };
}

export function playWrongAnswerTone(): void {
  if (typeof window === 'undefined') return;
  const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;

  try {
    const audioContext = new AudioContextCtor();
    const gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);

    let offsetSeconds = 0;
    WRONG_ANSWER_TONE_PATTERN.forEach((step) => {
      const oscillator = audioContext.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(step.frequency, audioContext.currentTime + offsetSeconds);
      oscillator.connect(gainNode);
      oscillator.start(audioContext.currentTime + offsetSeconds);
      oscillator.stop(audioContext.currentTime + offsetSeconds + step.durationMs / 1000);
      offsetSeconds += step.durationMs / 1000;
    });

    gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + offsetSeconds + 0.05);

    window.setTimeout(() => {
      void audioContext.close().catch(() => undefined);
    }, Math.ceil((offsetSeconds + 0.12) * 1000));
  } catch {
    // Audio feedback is best-effort only.
  }
}
