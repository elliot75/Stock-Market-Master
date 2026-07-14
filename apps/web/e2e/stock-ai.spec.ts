import { expect, test } from "@playwright/test";

const report = {
  stance: "NEUTRAL", confidence: 55, summary: "測試用 AI 摘要", technicalView: "測試技術面", fundamentalView: "測試基本面", chipView: "測試籌碼面",
  strengths: ["測試優勢"], risks: ["測試風險"], keyLevels: { support: 900, resistance: 1000, stopLoss: 880 },
  scenarios: [{ title: "測試情境", detail: "等待確認" }], dataLimitations: ["測試資料限制"],
};

test("logged-in users can generate an AI stock report and ask a follow-up", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("token", "e2e-token"));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path.endsWith("/overview")) return json({ stock: { symbol: "2330", name: "台積電", industry: "半導體" }, price: { date: "2026-07-14", close: 950, change: 5, changePercent: 0.5, volume: 1000000, turnover: 1000000 }, score: { compositeScore: 70, qualityScore: 70, timingScore: 65, riskScore: 30, category: "CORE_WATCH" } });
    if (path.endsWith("/chart")) return json({ symbol: "2330", candles: [{ date: "2026-07-14", open: 940, high: 955, low: 935, close: 950, volume: 1000000 }] });
    if (path.endsWith("/analysis") && path.includes("/api/stocks/")) return json({ technical: { ma5: 940, ma20: 920, ma60: 900, trendDirection: "多頭趨勢", maStatus: "多頭排列", kd: { k: 60, d: 55 }, kdSignal: "偏多", macd: { dif: 2 }, macdSignal: "偏多", rsi14: 55 }, chips: { daily: [], summary: {} }, volume: null, fundamentals: {}, keyLevels: null, scenarios: [] });
    if (path.endsWith("/watchlists")) return json([]);
    if (path.endsWith("/ai/providers")) return json([{ id: "custom", label: "自訂 LLM", model: "test-model", isDefault: true }]);
    if (path.endsWith("/ai/stocks/2330/analysis")) return json({ analysisId: "analysis-1", conversationId: "conversation-1", provider: "custom", model: "test-model", sourceDate: "2026-07-14", content: report, cacheHit: false, generatedAt: "2026-07-14T00:00:00.000Z" });
    if (path.endsWith("/ai/conversations/conversation-1") && route.request().method() === "GET") return json({ messages: [] });
    if (path.endsWith("/ai/conversations/conversation-1/messages")) return json({ id: "message-1", role: "ASSISTANT", content: "測試追問回答" });
    if (path.includes("/api/market/quotes")) return json({});
    return json({});
  });

  await page.goto("/stocks/2330");
  await expect(page.getByText("台積電").first()).toBeVisible();
  await page.getByRole("button", { name: "產生分析" }).click();
  await expect(page.getByText("測試用 AI 摘要")).toBeVisible();
  await page.getByPlaceholder(/針對這份報告繼續追問/).fill("測試問題");
  await page.getByRole("button", { name: "送出" }).click();
  await expect(page.getByText("測試追問回答")).toBeVisible();
});
