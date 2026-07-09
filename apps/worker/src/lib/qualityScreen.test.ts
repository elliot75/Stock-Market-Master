import { describe, expect, it } from "vitest";
import { evaluateAvailableQualityScreen } from "./qualityScreen.js";

describe("evaluateAvailableQualityScreen", () => {
  it("passes when available financial indicators clear the red lines", () => {
    const result = evaluateAvailableQualityScreen({
      eps: 2.3,
      grossMargin: 35,
      netMargin: 12,
      roe: 14,
      debtRatio: 42,
    });

    expect(result.verdict).toBe("pass");
    expect(result.passCount).toBe(5);
    expect(result.failCount).toBe(0);
    expect(result.unknownCount).toBe(2);
  });

  it("fails when any available indicator breaches a hard line", () => {
    const result = evaluateAvailableQualityScreen({
      eps: -0.4,
      grossMargin: 8,
      netMargin: -3,
      roe: 2,
      debtRatio: 88,
    });

    expect(result.verdict).toBe("fail");
    expect(result.failCount).toBe(5);
    expect(result.summary).toContain("觸發紅線");
  });

  it("keeps missing long-term metrics explicit instead of pretending they passed", () => {
    const result = evaluateAvailableQualityScreen(null);

    expect(result.verdict).toBe("watch");
    expect(result.unknownCount).toBe(7);
    expect(result.checks.map((check) => check.key)).toContain("freeCashFlow");
    expect(result.checks.map((check) => check.key)).toContain("shareDilution");
  });
});
