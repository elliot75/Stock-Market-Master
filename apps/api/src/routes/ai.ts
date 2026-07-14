import type { FastifyInstance } from "fastify";
import { Prisma, prisma } from "@repo/database";
import { z } from "zod";
import { complete, createReport, fingerprint, getLlmProvider, getLlmProviders } from "../services/aiService.js";

const reportRequestSchema = z.object({
  providerId: z.enum(["custom", "openai", "xai", "gemini"]).optional(),
  forceRefresh: z.boolean().optional(),
});

const messageSchema = z.object({ content: z.string().trim().min(1).max(500) });

function asNumber(value: unknown) {
  return value == null ? null : Number(value);
}

async function recordUsage(userId: string, provider: string, kind: "REPORT" | "FOLLOW_UP", cacheHit: boolean) {
  await prisma.aiUsageEvent.create({ data: { userId, provider, kind, cacheHit } });
}

async function assertUsageAllowed(userId: string, kind: "REPORT" | "FOLLOW_UP", forceRefresh = false) {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const hourly = await prisma.aiUsageEvent.count({ where: { userId, cacheHit: false, createdAt: { gte: hourAgo } } });
  if (hourly >= 30) throw new Error("AI 服務呼叫已達每小時上限，請稍後再試");
  if (kind === "REPORT" && forceRefresh) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const refreshes = await prisma.aiUsageEvent.count({ where: { userId, kind: "REPORT", cacheHit: false, createdAt: { gte: today } } });
    if (refreshes >= 3) throw new Error("重新分析已達每日上限");
  }
}

async function stockContext(symbol: string) {
  const [stock, prices, technical, score, trades, revenues, financial, recommendation] = await Promise.all([
    prisma.stock.findUnique({ where: { symbol }, select: { symbol: true, name: true, industry: true, marketType: true } }),
    prisma.dailyPrice.findMany({ where: { symbol }, orderBy: { date: "desc" }, take: 20 }),
    prisma.technicalSnapshot.findFirst({ where: { symbol }, orderBy: { date: "desc" } }),
    prisma.scoreSnapshot.findFirst({ where: { symbol }, orderBy: { date: "desc" } }),
    prisma.institutionalTradeDaily.findMany({ where: { symbol }, orderBy: { date: "desc" }, take: 10 }),
    prisma.monthlyRevenue.findMany({ where: { symbol }, orderBy: [{ year: "desc" }, { month: "desc" }], take: 6 }),
    prisma.quarterlyFinancial.findFirst({ where: { symbol }, orderBy: [{ year: "desc" }, { quarter: "desc" }] }),
    prisma.recommendationSnapshot.findFirst({ where: { symbol }, orderBy: { date: "desc" } }),
  ]);
  if (!stock) throw new Error("找不到股票");
  const latest = prices[0];
  if (!latest) throw new Error("此股票尚無可供 AI 分析的行情資料");
  const sourceDate = latest.date;
  const context = {
    stock,
    sourceDate: sourceDate.toISOString().slice(0, 10),
    prices: prices.map((price) => ({
      date: price.date.toISOString().slice(0, 10), open: asNumber(price.open), high: asNumber(price.high), low: asNumber(price.low), close: asNumber(price.close), volume: asNumber(price.volume), changePercent: asNumber(price.changePercent),
    })),
    technical: technical && {
      date: technical.date.toISOString().slice(0, 10), ma5: asNumber(technical.ma5), ma20: asNumber(technical.ma20), ma60: asNumber(technical.ma60), rsi14: asNumber(technical.rsi14), kdK: asNumber(technical.kdK), kdD: asNumber(technical.kdD), macdDif: asNumber(technical.macdDif), macdDea: asNumber(technical.macdDea), bias5: asNumber(technical.bias5), bias20: asNumber(technical.bias20),
    },
    score: score && { composite: asNumber(score.compositeScore), quality: asNumber(score.qualityScore), timing: asNumber(score.timingScore), risk: asNumber(score.riskScore), category: score.category, reasons: score.analysisJson },
    institutionalTrades: trades.map((trade) => ({ date: trade.date.toISOString().slice(0, 10), foreignNet: asNumber(trade.foreignNet), trustNet: asNumber(trade.trustNet), dealerNet: asNumber(trade.dealerNet), totalNet: asNumber(trade.totalNet) })),
    revenues: revenues.map((revenue) => ({ year: revenue.year, month: revenue.month, revenue: asNumber(revenue.revenue), yoy: asNumber(revenue.revenueYoY), mom: asNumber(revenue.revenueMoM) })),
    financial: financial && { year: financial.year, quarter: financial.quarter, eps: asNumber(financial.eps), grossMargin: asNumber(financial.grossMargin), operatingMargin: asNumber(financial.operatingMargin), netMargin: asNumber(financial.netMargin), roe: asNumber(financial.roe), debtRatio: asNumber(financial.debtRatio) },
    recommendation: recommendation && { title: recommendation.title, summary: recommendation.summary, support: asNumber(recommendation.supportPrice), resistance: asNumber(recommendation.resistPrice), stopLoss: asNumber(recommendation.stopLoss) },
  };
  return { stock, sourceDate, context };
}

function serializeAnalysis(analysis: { id: string; provider: string; model: string; sourceDate: Date; contentJson: unknown; createdAt: Date }, cacheHit: boolean, conversationId: string) {
  return {
    analysisId: analysis.id,
    conversationId,
    provider: analysis.provider,
    model: analysis.model,
    sourceDate: analysis.sourceDate,
    content: analysis.contentJson,
    cacheHit,
    generatedAt: analysis.createdAt,
  };
}

export async function aiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/providers", async () => {
    const defaultId = process.env.LLM_DEFAULT_PROVIDER;
    return getLlmProviders().map((provider, index) => ({ id: provider.id, label: provider.label, model: provider.model, isDefault: provider.id === defaultId || (!defaultId && index === 0) }));
  });

  app.post("/stocks/:symbol/analysis", async (request, reply) => {
    const userId = request.userId as string;
    const { symbol } = request.params as { symbol: string };
    const body = reportRequestSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "分析參數無效" });
    const provider = getLlmProvider(body.data.providerId);
    if (!provider) return reply.code(503).send({ error: "尚未設定可用的 AI 供應商" });
    try {
      const { sourceDate, context } = await stockContext(symbol);
      const sourceFingerprint = fingerprint(context);
      const cached = !body.data.forceRefresh
        ? await prisma.aiStockAnalysis.findFirst({ where: { symbol, provider: provider.id, model: provider.model, sourceFingerprint, promptVersion: 1 }, orderBy: { createdAt: "desc" } })
        : null;
      const analysis = cached ?? await (async () => {
        await assertUsageAllowed(userId, "REPORT", Boolean(body.data.forceRefresh));
        const result = await createReport(provider, context);
        return prisma.aiStockAnalysis.create({ data: { symbol, provider: provider.id, model: provider.model, sourceDate, sourceFingerprint, promptVersion: 1, contentJson: result.report as Prisma.InputJsonValue, usageJson: result.usage as Prisma.InputJsonValue | undefined } });
      })();
      await recordUsage(userId, provider.id, "REPORT", Boolean(cached));
      const previousConversation = await prisma.aiConversation.findFirst({ where: { userId, analysisId: analysis.id }, orderBy: { lastActiveAt: "desc" } });
      const conversation = previousConversation ?? await prisma.aiConversation.create({ data: { userId, symbol, analysisId: analysis.id, provider: provider.id, model: provider.model } });
      return serializeAnalysis(analysis, Boolean(cached), conversation.id);
    } catch (error) {
      return reply.code(502).send({ error: error instanceof Error ? error.message : "AI 分析失敗" });
    }
  });

  app.get("/conversations/:conversationId", async (request, reply) => {
    const userId = request.userId as string;
    const { conversationId } = request.params as { conversationId: string };
    const conversation = await prisma.aiConversation.findFirst({
      where: { id: conversationId, userId },
      include: { messages: { orderBy: { createdAt: "asc" } }, analysis: { select: { contentJson: true, sourceDate: true } } },
    });
    if (!conversation) return reply.code(404).send({ error: "AI 對話不存在" });
    return conversation;
  });

  app.post("/conversations/:conversationId/messages", async (request, reply) => {
    const userId = request.userId as string;
    const { conversationId } = request.params as { conversationId: string };
    const body = messageSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "問題需為 1 至 500 字" });
    const conversation = await prisma.aiConversation.findFirst({
      where: { id: conversationId, userId },
      include: { analysis: true, messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation) return reply.code(404).send({ error: "AI 對話不存在" });
    if (conversation.messages.filter((message) => message.role === "USER").length >= 20) return reply.code(429).send({ error: "此對話已達 20 次追問上限，請重新分析後開啟新對話" });
    const provider = getLlmProvider(conversation.provider);
    if (!provider || provider.model !== conversation.model) return reply.code(503).send({ error: "建立此對話的 AI 供應商目前不可用" });
    try {
      await assertUsageAllowed(userId, "FOLLOW_UP");
      const history = conversation.messages.slice(-12).map((message) => ({ role: message.role === "USER" ? "user" as const : "assistant" as const, content: message.content }));
      const result = await complete({
        provider,
        messages: [
          { role: "system", content: "你是台股資料分析助理。只根據以下既有報告回答，資料不足時明確說明；不可捏造資料、保證獲利或提供個人化投資指令。\n既有報告：" + JSON.stringify(conversation.analysis.contentJson) },
          ...history,
          { role: "user", content: body.data.content },
        ],
      });
      const [, assistant] = await prisma.$transaction([
        prisma.aiMessage.create({ data: { conversationId, role: "USER", content: body.data.content } }),
        prisma.aiMessage.create({ data: { conversationId, role: "ASSISTANT", content: result.content, usageJson: result.usage as Prisma.InputJsonValue | undefined } }),
        prisma.aiConversation.update({ where: { id: conversationId }, data: { lastActiveAt: new Date() } }),
        prisma.aiUsageEvent.create({ data: { userId, provider: provider.id, kind: "FOLLOW_UP", cacheHit: false } }),
      ]);
      return assistant;
    } catch (error) {
      return reply.code(502).send({ error: error instanceof Error ? error.message : "AI 追問失敗" });
    }
  });

  app.delete("/conversations/:conversationId", async (request, reply) => {
    const userId = request.userId as string;
    const { conversationId } = request.params as { conversationId: string };
    const conversation = await prisma.aiConversation.findFirst({ where: { id: conversationId, userId }, select: { id: true } });
    if (!conversation) return reply.code(404).send({ error: "AI 對話不存在" });
    await prisma.aiConversation.delete({ where: { id: conversation.id } });
    return reply.code(204).send();
  });
}
