import { prisma } from "@repo/database";
import { evaluateAlertRule } from "../lib/alertEvaluator.js";
import { dispatchAlertNotifications } from "../lib/notifications.js";

interface Quote {
  close: number;
  volume: number;
  timestamp: Date;
}

let running = false;

function taipeiDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const field = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${field("year")}-${field("month")}-${field("day")}`;
}

function taipeiDayBounds(now = new Date()) {
  const [year, month, day] = taipeiDate(now).split("-").map(Number);
  const start = new Date(Date.UTC(year!, month! - 1, day!, -8));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

async function quote(symbol: string, marketType: "TWSE" | "TPEX"): Promise<Quote | null> {
  try {
    const suffix = marketType === "TPEX" ? ".TWO" : ".TW";
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}${suffix}?range=1d&interval=1m`, {
      headers: { "User-Agent": "Stock-Market-Master/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const body = await response.json() as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; regularMarketTime?: number; regularMarketVolume?: number } }> } };
    const meta = body.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice || !meta.regularMarketTime) return null;
    const timestamp = new Date(meta.regularMarketTime * 1000);
    return taipeiDate(timestamp) === taipeiDate(new Date())
      ? { close: meta.regularMarketPrice, volume: meta.regularMarketVolume || 0, timestamp }
      : null;
  } catch (error) {
    console.warn(`[checkIntradayAlerts] ${symbol} quote unavailable:`, error instanceof Error ? error.message : error);
    return null;
  }
}

export async function checkIntradayAlerts() {
  if (running) return;
  running = true;
  try {
    const rules = await prisma.alertRule.findMany({
      where: { isActive: true, conditionType: { in: ["PRICE_ABOVE", "PRICE_BELOW", "BREAK_SUPPORT", "BREAK_RESISTANCE"] } },
      include: { stock: { select: { name: true, marketType: true } } },
    });
    const quotes = new Map<string, Quote | null>();
    await Promise.all([...new Map(rules.map((rule) => [rule.symbol, rule])).values()].map(async (rule) => {
      quotes.set(rule.symbol, await quote(rule.symbol, rule.stock.marketType));
    }));
    const { start, end } = taipeiDayBounds();
    let triggered = 0;
    for (const rule of rules) {
      const latest = quotes.get(rule.symbol);
      if (!latest) continue;
      const [recentPrices, keyLevels, existing] = await Promise.all([
        prisma.dailyPrice.findMany({ where: { symbol: rule.symbol }, orderBy: { date: "desc" }, take: 6 }),
        prisma.recommendationSnapshot.findFirst({ where: { symbol: rule.symbol }, orderBy: { date: "desc" }, select: { supportPrice: true, resistPrice: true } }),
        prisma.alertEvent.findFirst({ where: { ruleId: rule.id, triggeredAt: { gte: start, lt: end } }, select: { id: true } }),
      ]);
      if (existing) continue;
      const evaluation = evaluateAlertRule({
        rule: { conditionType: rule.conditionType, threshold: rule.threshold == null ? null : Number(rule.threshold) },
        latestPrice: { close: latest.close, volume: latest.volume },
        recentPrices: recentPrices.map((price) => ({ close: Number(price.close), volume: Number(price.volume) })),
        recentScores: [], recentTrades: [],
        keyLevels: keyLevels ? { supportPrice: keyLevels.supportPrice == null ? null : Number(keyLevels.supportPrice), resistPrice: keyLevels.resistPrice == null ? null : Number(keyLevels.resistPrice) } : null,
        stockName: rule.stock.name, symbol: rule.symbol,
      });
      if (!evaluation.triggered) continue;
      const event = await prisma.alertEvent.create({ data: { ruleId: rule.id, message: evaluation.message, metadata: { source: "yahoo-intraday", observedPrice: latest.close, quoteAt: latest.timestamp.toISOString() } } });
      await dispatchAlertNotifications({ eventId: event.id, userId: rule.userId, message: evaluation.message });
      triggered++;
    }
    await prisma.ingestionJob.create({ data: { jobType: "check_intraday_alerts", status: "SUCCESS", startedAt: new Date(), endedAt: new Date(), recordCount: triggered, metadata: { totalRules: rules.length } } });
  } catch (error) {
    console.error("[checkIntradayAlerts] Failed:", error);
    await prisma.ingestionJob.create({ data: { jobType: "check_intraday_alerts", status: "FAILED", startedAt: new Date(), endedAt: new Date(), errorMessage: error instanceof Error ? error.message : String(error) } });
  } finally {
    running = false;
  }
}
