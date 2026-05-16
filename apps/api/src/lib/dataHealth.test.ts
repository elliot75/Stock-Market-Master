import { describe, expect, it } from "vitest";
import { deriveDataHealthStatus } from "./dataHealth.js";

describe("deriveDataHealthStatus", () => {
  it("prioritizes failed jobs", () => {
    expect(deriveDataHealthStatus({
      hasFailedJob: true,
      hasDateMismatch: false,
      missingPriceCount: 0,
      missingScoreCount: 0,
      missingTechCount: 0,
    })).toBe("failed");
  });

  it("marks missing coverage as delayed", () => {
    expect(deriveDataHealthStatus({
      hasFailedJob: false,
      hasDateMismatch: false,
      missingPriceCount: 0,
      missingScoreCount: 2,
      missingTechCount: 0,
    })).toBe("delayed");
  });
});
