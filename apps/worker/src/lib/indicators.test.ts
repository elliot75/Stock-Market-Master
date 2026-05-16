import { describe, expect, it } from "vitest";
import { calcKD, calcMACD, calcSMA, calculateIndicatorSet } from "./indicators.js";

describe("technical indicators", () => {
  const closes = Array.from({ length: 60 }, (_, i) => 100 + i).reverse();
  const highs = closes.map((close) => close + 2);
  const lows = closes.map((close) => close - 2);

  it("calculates simple moving averages from newest prices", () => {
    expect(calcSMA([10, 9, 8, 7, 6], 5)).toBe(8);
  });

  it("calculates smoothed KD instead of returning identical K and D", () => {
    const kd = calcKD(highs, lows, closes);
    expect(kd).not.toBeNull();
    expect(kd!.k).not.toBe(kd!.d);
  });

  it("calculates MACD signal line from a series", () => {
    const macd = calcMACD(closes);
    expect(macd).not.toBeNull();
    expect(macd!.dea).not.toBeCloseTo(macd!.dif * 0.2);
  });

  it("returns a complete indicator set with bias values", () => {
    const result = calculateIndicatorSet({ closes, highs, lows });
    expect(result.ma5).not.toBeNull();
    expect(result.rsi14).not.toBeNull();
    expect(result.bias5).not.toBeNull();
  });
});
