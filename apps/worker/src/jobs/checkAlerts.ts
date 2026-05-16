/**
 * Job: 檢查提醒規則
 * 排程: 每日 18:00 (Mon-Fri)
 */
import { prisma } from "@repo/database";
import { evaluateAlertRule } from "../lib/alertEvaluator.js";
import { dispatchAlertNotifications } from "../lib/notifications.js";

export async function checkAlerts() {
  console.log("[checkAlerts] Starting...");

  try {
    const activeRules = await prisma.alertRule.findMany({
      where: { isActive: true },
      include: { stock: { select: { name: true } } },
    });

    console.log(`[checkAlerts] ${activeRules.length} active rules found.`);

    let triggeredCount = 0;

    for (const rule of activeRules) {
      const latestPrice = await prisma.dailyPrice.findFirst({
        where: { symbol: rule.symbol },
        orderBy: { date: "desc" },
      });

      if (!latestPrice) continue;

      const [recentPrices, recentScores, recentTrades, keyLevels] =
        await Promise.all([
          prisma.dailyPrice.findMany({
            where: { symbol: rule.symbol },
            orderBy: { date: "desc" },
            take: 6,
          }),
          prisma.scoreSnapshot.findMany({
            where: { symbol: rule.symbol },
            orderBy: { date: "desc" },
            take: 2,
          }),
          prisma.institutionalTradeDaily.findMany({
            where: { symbol: rule.symbol },
            orderBy: { date: "desc" },
            take: 2,
          }),
          prisma.recommendationSnapshot.findFirst({
            where: { symbol: rule.symbol },
            orderBy: { date: "desc" },
            select: { supportPrice: true, resistPrice: true },
          }),
        ]);

      const evaluation = evaluateAlertRule({
        rule: {
          conditionType: rule.conditionType,
          threshold: rule.threshold != null ? Number(rule.threshold) : null,
        },
        latestPrice: {
          close: Number(latestPrice.close),
          volume: Number(latestPrice.volume),
        },
        recentPrices: recentPrices.map((price) => ({
          close: Number(price.close),
          volume: Number(price.volume),
        })),
        recentScores: recentScores.map((score) => ({
          compositeScore: score.compositeScore ? Number(score.compositeScore) : null,
        })),
        recentTrades: recentTrades.map((trade) => ({
          foreignNet: Number(trade.foreignNet),
          trustNet: Number(trade.trustNet),
        })),
        keyLevels: keyLevels
          ? {
              supportPrice: keyLevels.supportPrice ? Number(keyLevels.supportPrice) : null,
              resistPrice: keyLevels.resistPrice ? Number(keyLevels.resistPrice) : null,
            }
          : null,
        stockName: rule.stock.name,
        symbol: rule.symbol,
      });

      if (evaluation.triggered) {
        const tradeDateStart = new Date(latestPrice.date);
        tradeDateStart.setHours(0, 0, 0, 0);
        const tradeDateEnd = new Date(tradeDateStart);
        tradeDateEnd.setDate(tradeDateEnd.getDate() + 1);
        const existingEvent = await prisma.alertEvent.findFirst({
          where: {
            ruleId: rule.id,
            triggeredAt: { gte: tradeDateStart, lt: tradeDateEnd },
          },
          select: { id: true },
        });
        if (existingEvent) continue;

        const event = await prisma.alertEvent.create({
          data: {
            ruleId: rule.id,
            message: evaluation.message,
          },
        });
        await dispatchAlertNotifications({
          eventId: event.id,
          userId: rule.userId,
          message: evaluation.message,
        });
        triggeredCount++;
      }
    }

    await prisma.ingestionJob.create({
      data: {
        jobType: "check_alerts",
        status: "SUCCESS",
        startedAt: new Date(),
        endedAt: new Date(),
        recordCount: triggeredCount,
        metadata: { totalRules: activeRules.length },
      },
    });

    console.log(
      `[checkAlerts] Done. ${triggeredCount} alerts triggered.`
    );
  } catch (error) {
    console.error("[checkAlerts] Failed:", error);

    await prisma.ingestionJob.create({
      data: {
        jobType: "check_alerts",
        status: "FAILED",
        startedAt: new Date(),
        endedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  checkAlerts().then(() => process.exit(0));
}
