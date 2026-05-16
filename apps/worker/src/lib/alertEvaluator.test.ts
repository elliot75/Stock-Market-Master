import { describe, expect, it } from "vitest";
import { evaluateAlertRule, type AlertEvaluationInput } from "./alertEvaluator.js";

const base: AlertEvaluationInput = {
  rule: { conditionType: "PRICE_ABOVE", threshold: 100 },
  latestPrice: { close: 110, volume: 1000 },
  recentPrices: [
    { close: 110, volume: 3000 },
    { close: 100, volume: 1000 },
    { close: 100, volume: 1000 },
    { close: 100, volume: 1000 },
    { close: 100, volume: 1000 },
    { close: 100, volume: 1000 },
  ],
  recentScores: [{ compositeScore: 70 }, { compositeScore: 55 }],
  recentTrades: [
    { foreignNet: 100, trustNet: 50 },
    { foreignNet: -10, trustNet: -5 },
  ],
  keyLevels: { supportPrice: 90, resistPrice: 108 },
  stockName: "台積電",
  symbol: "2330",
};

describe("evaluateAlertRule", () => {
  it("triggers price alerts", () => {
    expect(evaluateAlertRule(base).triggered).toBe(true);
  });

  it("triggers institutional turn alerts", () => {
    expect(
      evaluateAlertRule({
        ...base,
        rule: { conditionType: "FOREIGN_NET_BUY", threshold: null },
      }).triggered
    ).toBe(true);
  });

  it("triggers support and resistance alerts", () => {
    expect(
      evaluateAlertRule({
        ...base,
        rule: { conditionType: "BREAK_RESISTANCE", threshold: null },
      }).triggered
    ).toBe(true);
  });

  it("does not trigger when the condition is not met", () => {
    expect(
      evaluateAlertRule({
        ...base,
        rule: { conditionType: "PRICE_BELOW", threshold: 100 },
      }).triggered
    ).toBe(false);
  });
});
