import { describe, expect, it } from "vitest";
import { getMacdSignal } from "./technicalSignals.js";

describe("getMacdSignal", () => {
  it("labels bullish MACD expansion and contraction correctly", () => {
    expect(getMacdSignal({ macdDif: 1, macdHist: 0.5 })).toBe("多頭擴張");
    expect(getMacdSignal({ macdDif: 1, macdHist: -0.5 })).toBe("多頭縮減");
  });

  it("labels bearish MACD expansion and contraction correctly", () => {
    expect(getMacdSignal({ macdDif: -1, macdHist: -0.5 })).toBe("空頭擴張");
    expect(getMacdSignal({ macdDif: -1, macdHist: 0.5 })).toBe("空頭縮減");
  });
});
