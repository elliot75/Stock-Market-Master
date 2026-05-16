import { describe, expect, it } from "vitest";
import { summarizeBacktest } from "./backtest.js";

describe("summarizeBacktest", () => {
  it("computes win rate and drawdown", () => {
    expect(summarizeBacktest([
      { returnPercent: 10, maxDrawdownPercent: -3 },
      { returnPercent: -5, maxDrawdownPercent: -8 },
    ])).toEqual({
      total: 2,
      winRate: 50,
      avgReturn: 2.5,
      maxDrawdown: -8,
    });
  });
});
