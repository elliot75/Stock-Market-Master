import { describe, expect, it } from "vitest";
import { calculateHoldingMetrics, summarizePortfolioReview } from "./portfolioMetrics.js";

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

describe("summarizePortfolioReview", () => {
  it("computes concentration and industry exposure", () => {
    const summary = summarizePortfolioReview([
      { symbol: "2330", industry: "半導體", marketValue: 600_000 },
      { symbol: "2454", industry: "半導體", marketValue: 250_000 },
      { symbol: "2412", industry: "通信網路", marketValue: 150_000 },
    ]);

    expect(summary.totalMarketValue).toBe(1_000_000);
    expect(summary.topHoldingPercent).toBe(60);
    expect(summary.topThreePercent).toBe(100);
    expect(summary.concentrationLevel).toBe("high");
    expect(summary.industryExposure[0]).toEqual({
      industry: "半導體",
      marketValue: 850_000,
      percent: 85,
    });
  });
});
