import { describe, expect, it } from "vitest";
import { calculateHoldingMetrics } from "./portfolioMetrics.js";

describe("calculateHoldingMetrics", () => {
  it("computes holding PnL", () => {
    expect(calculateHoldingMetrics({
      shares: 1000,
      averageCost: 50,
      latestPrice: 55,
    })).toEqual({
      costValue: 50000,
      marketValue: 55000,
      unrealizedPnl: 5000,
      unrealizedPnlPercent: 10,
    });
  });
});
