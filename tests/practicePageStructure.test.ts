import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const practicePageSource = readFileSync("src/pages/PracticePage.tsx", "utf8");
const modeHubSource = readFileSync("src/pages/ModeHubPage.tsx", "utf8");

describe("practice page structure", () => {
  it("renders a visible return button on practice modules", () => {
    expect(practicePageSource).toContain('className="practice-back-button"');
    expect(practicePageSource).toContain("返回首页");
  });

  it("does not advertise twenty-question practice rounds from the hub", () => {
    expect(modeHubSource).not.toContain("每日 20 题");
    expect(modeHubSource).not.toContain("今日 20 题");
    expect(modeHubSource).toContain("每日 10 题");
  });
});
