import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReport, getLlmProviders } from "./aiService.js";

describe("AI providers", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    process.env.LLM_BASE_URL = "localhost:11434/v1";
    process.env.LLM_MODEL = "local-model";
    delete process.env.LLM_API_KEY;
  });

  it("accepts a scheme-less custom base URL without exposing keys", () => {
    expect(getLlmProviders()).toContainEqual(expect.objectContaining({ id: "custom", baseUrl: "http://localhost:11434/v1", model: "local-model" }));
  });

  it("parses a structured report from an OpenAI-compatible response", async () => {
    const content = JSON.stringify({
      stance: "NEUTRAL", confidence: 50, summary: "資料有限。", technicalView: "盤整。", fundamentalView: "尚待觀察。", chipView: "中性。",
      strengths: ["流動性"], risks: ["波動"], keyLevels: { support: 100, resistance: 110, stopLoss: 95 }, scenarios: [{ title: "區間", detail: "等待突破" }], dataLimitations: ["未含即時新聞"],
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }));
    const provider = getLlmProviders()[0]!;
    const result = await createReport(provider, { symbol: "2330" });
    expect(result.report.stance).toBe("NEUTRAL");
    expect(result.report.keyLevels.support).toBe(100);
  });
});
