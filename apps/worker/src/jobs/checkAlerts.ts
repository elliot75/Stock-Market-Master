/**
 * Job: 檢查提醒規則
 * 排程: 每日 18:00 (Mon-Fri)
 */
import { prisma } from "@repo/database";

export async function checkAlerts() {
  console.log("[checkAlerts] Starting...");

  try {
    const activeRules = await prisma.alertRule.findMany({
      where: { isActive: true },
      include: { stock: { select: { name: true } } },
    });

    console.log(`[checkAlerts] ${activeRules.length} active rules found.`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let triggeredCount = 0;

    for (const rule of activeRules) {
      const latestPrice = await prisma.dailyPrice.findFirst({
        where: { symbol: rule.symbol },
        orderBy: { date: "desc" },
      });

      if (!latestPrice) continue;

      const close = Number(latestPrice.close);
      const threshold = rule.threshold ? Number(rule.threshold) : null;
      let triggered = false;
      let message = "";

      switch (rule.conditionType) {
        case "PRICE_ABOVE":
          if (threshold && close >= threshold) {
            triggered = true;
            message = `${rule.stock.name}(${rule.symbol}) 股價 ${close} 突破 ${threshold}`;
          }
          break;
        case "PRICE_BELOW":
          if (threshold && close <= threshold) {
            triggered = true;
            message = `${rule.stock.name}(${rule.symbol}) 股價 ${close} 跌破 ${threshold}`;
          }
          break;
        case "VOLUME_SPIKE": {
          // 量能是否超過 5 日均量 2 倍
          const recentPrices = await prisma.dailyPrice.findMany({
            where: { symbol: rule.symbol },
            orderBy: { date: "desc" },
            take: 6,
          });
          if (recentPrices.length >= 6) {
            const avgVol =
              recentPrices
                .slice(1)
                .reduce((s, p) => s + Number(p.volume), 0) / 5;
            if (Number(latestPrice.volume) > avgVol * 2) {
              triggered = true;
              message = `${rule.stock.name}(${rule.symbol}) 成交量異常放大，為均量 ${(Number(latestPrice.volume) / avgVol).toFixed(1)} 倍`;
            }
          }
          break;
        }
        case "SCORE_UPGRADE":
        case "SCORE_DOWNGRADE": {
          const scores = await prisma.scoreSnapshot.findMany({
            where: { symbol: rule.symbol },
            orderBy: { date: "desc" },
            take: 2,
          });
          if (scores.length === 2) {
            const todayComposite = Number(scores[0].compositeScore || 0);
            const yesterdayComposite = Number(scores[1].compositeScore || 0);
            const diff = todayComposite - yesterdayComposite;
            if (
              rule.conditionType === "SCORE_UPGRADE" &&
              diff > 10
            ) {
              triggered = true;
              message = `${rule.stock.name}(${rule.symbol}) 綜合評分升級 +${diff.toFixed(1)} 分`;
            } else if (
              rule.conditionType === "SCORE_DOWNGRADE" &&
              diff < -10
            ) {
              triggered = true;
              message = `${rule.stock.name}(${rule.symbol}) 綜合評分降級 ${diff.toFixed(1)} 分`;
            }
          }
          break;
        }
        default:
          break;
      }

      if (triggered) {
        await prisma.alertEvent.create({
          data: {
            ruleId: rule.id,
            message,
          },
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
