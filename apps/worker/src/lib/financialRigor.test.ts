import { describe, expect, it } from "vitest";
import {
  calculateMarketCap,
  calculateValuation,
  deriveTaiwanSharesFromCapitalThousand,
  verifyMarketCap,
} from "./financialRigor.js";

describe("financialRigor", () => {
  it("derives Taiwan shares from capital reported in thousand NTD", () => {
    expect(deriveTaiwanSharesFromCapitalThousand(259_303_805n)).toBe(
      25_930_380_500n
    );
  });

  it("calculates market cap with exact decimal multiplication", () => {
    expect(calculateMarketCap({ price: "510.5", shares: 1000 })).toEqual({
      marketCap: 510500,
      marketCapHundredMillion: 0.005105,
    });
  });

  it("verifies market cap deviation against a reported value", () => {
    const result = verifyMarketCap({
      price: "510",
      shares: "9.11e9",
      reportedMarketCap: "4.65e12",
    });
    expect(result.status).toBe("pass");
    expect(result.deviationPercent).toBeCloseTo(0.0838);
  });

  it("calculates valuation ratios from per-share inputs", () => {
    expect(
      calculateValuation({
        price: "120",
        eps: "6",
        bookValuePerShare: "30",
        fcfPerShare: "8",
        dividend: "3",
      })
    ).toEqual({
      pe: 20,
      pb: 4,
      fcfYieldPercent: 6.6666,
      dividendYieldPercent: 2.5,
    });
  });
});
