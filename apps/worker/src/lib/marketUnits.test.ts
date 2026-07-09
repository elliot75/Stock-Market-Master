import { describe, expect, it } from "vitest";
import { formatSharesAsLots } from "./marketUnits.js";

describe("marketUnits", () => {
  it("formats TWSE share counts as lots", () => {
    expect(formatSharesAsLots(1_250_000)).toBe("1,250 張");
    expect(formatSharesAsLots(1_500)).toBe("1.5 張");
  });
});
