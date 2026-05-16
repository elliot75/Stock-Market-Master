/**
 * Job: 計算技術指標
 * 依賴: daily_prices 資料
 * 排程: 每日 17:00 (Mon-Fri)
 *
 * 計算項目: MA5/10/20/60/120/240, RSI(14), KD(9,3,3), MACD(12,26,9), 乖離率
 */
import { prisma } from "@repo/database";
import { calculateIndicatorSet } from "../lib/indicators.js";

export async function calculateIndicators() {
  console.log("[calculateIndicators] Starting...");

  try {
    // 取得所有活躍股票
    const stocks = await prisma.stock.findMany({
      where: { status: "ACTIVE" },
      select: { symbol: true },
    });

    console.log(`[calculateIndicators] Processing ${stocks.length} stocks...`);

    let count = 0;

    for (const { symbol } of stocks) {
      // 取最近 260 筆日線 (足夠算 MA240)
      const dailyPrices = await prisma.dailyPrice.findMany({
        where: { symbol },
        orderBy: { date: "desc" },
        take: 260,
      });

      if (dailyPrices.length < 5) continue; // 資料太少跳過

      const closes = dailyPrices.map((d) => Number(d.close));
      const highs = dailyPrices.map((d) => Number(d.high));
      const lows = dailyPrices.map((d) => Number(d.low));
      const latestPrice = dailyPrices[0];
      if (!latestPrice) continue;
      const snapshotDate = latestPrice.date;
      const indicators = calculateIndicatorSet({ closes, highs, lows });

      await prisma.technicalSnapshot.upsert({
        where: {
          symbol_date: { symbol, date: snapshotDate },
        },
        update: {
          ...indicators,
        },
        create: {
          symbol,
          date: snapshotDate,
          ...indicators,
        },
      });

      count++;
    }

    await prisma.ingestionJob.create({
      data: {
        jobType: "calculate_indicators",
        status: "SUCCESS",
        startedAt: new Date(),
        endedAt: new Date(),
        recordCount: count,
      },
    });

    console.log(`[calculateIndicators] Done. ${count} snapshots.`);
  } catch (error) {
    console.error("[calculateIndicators] Failed:", error);

    await prisma.ingestionJob.create({
      data: {
        jobType: "calculate_indicators",
        status: "FAILED",
        startedAt: new Date(),
        endedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  calculateIndicators().then(() => process.exit(0));
}
