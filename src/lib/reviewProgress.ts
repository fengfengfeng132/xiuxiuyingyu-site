import { isReviewTask } from '../schema/reviewSchema';
import type { ReviewTask, SessionAnswer } from '../types/schema';

interface TimedAnswer {
  answer: SessionAnswer;
  answeredAt: number;
}

export function getPendingReviewQuestionIds(task: ReviewTask): number[] {
  if (task.completed) return [];
  const completedIds = new Set(task.completedQuestionIds ?? []);
  return [...new Set(task.questionIds)].filter((questionId) => !completedIds.has(questionId));
}

function latestAnswersBefore(answers: SessionAnswer[], now: number): Map<number, TimedAnswer> {
  const latest = new Map<number, TimedAnswer>();
  for (const answer of answers) {
    const answeredAt = Date.parse(answer.answeredAt);
    if (!Number.isFinite(answeredAt) || answeredAt > now || typeof answer.isCorrect !== 'boolean') continue;
    const previous = latest.get(answer.questionId);
    if (!previous || answeredAt >= previous.answeredAt) latest.set(answer.questionId, { answer, answeredAt });
  }
  return latest;
}

function applyTaskAnswers(task: ReviewTask, latest: Map<number, TimedAnswer>, now: number): ReviewTask {
  if (!isReviewTask(task) || task.completed || task.questionIds.length === 0) return task;
  const dueAt = Date.parse(task.dueAt);
  if (!Number.isFinite(dueAt) || dueAt > now) return task;

  const previousIds = new Set(task.completedQuestionIds ?? []);
  const completedIds = new Set(previousIds);
  let hasAnswer = false;
  for (const questionId of task.questionIds) {
    const latestAnswer = latest.get(questionId);
    if (!latestAnswer || latestAnswer.answeredAt < dueAt) continue;
    hasAnswer = true;
    if (latestAnswer.answer.isCorrect) completedIds.add(questionId);
    else completedIds.delete(questionId);
  }
  if (!hasAnswer) return task;

  const completed = task.questionIds.every((questionId) => completedIds.has(questionId));
  const sameProgress = completedIds.size === previousIds.size && [...completedIds].every((questionId) => previousIds.has(questionId));
  if (sameProgress && completed === task.completed) return task;

  return { ...task, completedQuestionIds: [...completedIds], completed };
}

export function applyReviewAnswers(tasks: ReviewTask[], answers: SessionAnswer[], now: Date): ReviewTask[] {
  const timestamp = now.getTime();
  if (!Number.isFinite(timestamp) || tasks.length === 0 || answers.length === 0) return tasks;
  const latest = latestAnswersBefore(answers, timestamp);
  if (latest.size === 0) return tasks;

  const updated = tasks.map((task) => applyTaskAnswers(task, latest, timestamp));
  return updated.some((task, index) => task !== tasks[index]) ? updated : tasks;
}
