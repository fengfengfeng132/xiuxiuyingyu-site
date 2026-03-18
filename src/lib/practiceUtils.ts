import type { Question, ReviewTask } from '../types/schema';

export const REVIEW_DAY_OFFSETS = [1, 3, 7, 14] as const;

export function getLocalDaySeed(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function pickDailyQuestions(bank: Question[], count: number, date: Date = new Date()): Question[] {
  const daySeed = getLocalDaySeed(date);
  const seedCode = daySeed.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

  return [...bank]
    .sort((a, b) => {
      const aScore = (a.id * 131 + seedCode * 17) % 997;
      const bScore = (b.id * 131 + seedCode * 17) % 997;
      return aScore - bScore;
    })
    .slice(0, Math.min(count, bank.length));
}

export function cloneReviewTasks(tasks: ReviewTask[]): ReviewTask[] {
  return tasks.map((task) => ({
    ...task,
    questionIds: [...task.questionIds],
  }));
}

export function scheduleReviewTasks(
  currentTasks: ReviewTask[],
  questionId: number,
  baseDate: Date,
  dayOffsets: readonly number[] = REVIEW_DAY_OFFSETS,
): ReviewTask[] {
  const tasks = cloneReviewTasks(currentTasks);

  dayOffsets.forEach((offset) => {
    const due = new Date(baseDate);
    due.setDate(due.getDate() + offset);
    due.setHours(19, 0, 0, 0);

    const dueDay = getLocalDaySeed(due);
    const existing = tasks.find((task) => !task.completed && getLocalDaySeed(new Date(task.dueAt)) === dueDay);

    if (existing) {
      if (!existing.questionIds.includes(questionId)) {
        existing.questionIds.push(questionId);
      }
      return;
    }

    tasks.push({
      id: crypto.randomUUID(),
      questionIds: [questionId],
      dueAt: due.toISOString(),
      completed: false,
    });
  });

  return tasks
    .map((task) => ({ ...task, questionIds: Array.from(new Set(task.questionIds)) }))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 180);
}
