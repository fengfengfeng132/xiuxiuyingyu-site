import { describe, expect, it } from "vitest";
import { cloneReviewTasks, getLocalDaySeed, pickDailyQuestions, scheduleReviewTasks } from "../src/lib/practiceUtils";
import type { Question, ReviewTask } from "../src/types/schema";

function makeQuestion(id: number): Question {
  return {
    id,
    level: "L2",
    unit: 1,
    type: "single_choice",
    prompt: "word-" + id,
    stem: "stem-" + id,
    options: ["A", "B", "C", "D"],
    answerIndex: 0,
    explanation: "word-" + id + " meaning-" + id,
    tags: ["vocab"],
    audioText: "word-" + id,
  };
}

describe("practiceUtils", () => {
  it("uses local day seed across local midnight", () => {
    const day1 = new Date("2026-03-18T23:59:00+08:00");
    const day2 = new Date("2026-03-19T00:01:00+08:00");

    expect(getLocalDaySeed(day1)).toBe("2026-03-18");
    expect(getLocalDaySeed(day2)).toBe("2026-03-19");
  });

  it("daily pick is deterministic in one day and changes on next day", () => {
    const bank = Array.from({ length: 30 }, (_, idx) => makeQuestion(idx + 1));
    const day1 = new Date("2026-03-18T10:00:00+08:00");
    const day2 = new Date("2026-03-19T10:00:00+08:00");

    const resultA = pickDailyQuestions(bank, 12, day1).map((item) => item.id);
    const resultB = pickDailyQuestions(bank, 12, day1).map((item) => item.id);
    const resultNextDay = pickDailyQuestions(bank, 12, day2).map((item) => item.id);

    expect(resultA).toEqual(resultB);
    expect(resultA).not.toEqual(resultNextDay);
  });

  it("supports review task rollback snapshot without mutation side effects", () => {
    const initial: ReviewTask[] = [
      {
        id: "seed-task",
        questionIds: [1],
        dueAt: "2026-03-20T11:00:00.000Z",
        completed: false,
      },
    ];

    const snapshot = cloneReviewTasks(initial);
    const generated = scheduleReviewTasks(initial, 42, new Date("2026-03-18T09:00:00+08:00"));

    expect(generated.length).toBeGreaterThan(snapshot.length);
    expect(initial).toEqual([
      {
        id: "seed-task",
        questionIds: [1],
        dueAt: "2026-03-20T11:00:00.000Z",
        completed: false,
      },
    ]);

    generated[0].questionIds.push(999);
    expect(snapshot[0].questionIds).toEqual([1]);

    const restored = cloneReviewTasks(snapshot);
    expect(restored).toEqual(snapshot);
  });
});