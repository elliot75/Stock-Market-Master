/**
 * Job: 同步當日收盤價
 * 來源: TWSE OpenAPI 每日收盤行情
 * 排程: 每日 15:30 (Mon-Fri)
 */
import { prisma } from "@repo/database";

const TWSE_BASE = process.env.TWSE_BASE_URL || "https://openapi.twse.com.tw";

export async function syncDailyPrices() {
  console.log("[syncDailyPrices] Starting...");

  try {
    // TWSE 每日收盤行情 (全部上市股票)
    const res = await fetch(
      `${TWSE_BASE}/v1/exchangeReport/STOCK_DAY_ALL`
    );

    if (!res.ok) {
      throw new Error(`TWSE daily prices API error: ${res.status}`);
    }

    const data = (await res.json()) as Array<{
      Code: string;
      Name: string;
      TradeVolume: string;
      TradeValue: string;
      OpeningPrice: string;
      HighestPrice: string;
      LowestPrice: string;
      ClosingPrice: string;
      Change: string;
      Transaction: string;
    }>;

    console.log(`[syncDailyPrices] ${data.length} records fetched`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let upsertCount = 0;

    for (const row of data) {
      const symbol = row.Code?.trim();
      if (!symbol) continue;

      const close = parseFloat(row.ClosingPrice);
      if (isNaN(close) || close <= 0) continue;

      // 確認 stock 存在
      const stockExists = await prisma.stock.findUnique({
        where: { symbol },
        select: { symbol: true },
      });
      if (!stockExists) continue;

      const change = parseFloat(row.Change) || 0;
      const prevClose = close - change;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

      const priceData = {
        open: parseFloat(row.OpeningPrice) || 0,
        high: parseFloat(row.HighestPrice) || 0,
        low: parseFloat(row.LowestPrice) || 0,
        close,
        volume: BigInt(row.TradeVolume?.replace(/,/g, "") || "0"),
        turnover: BigInt(row.TradeValue?.replace(/,/g, "") || "0"),
        transactionCount: parseInt(row.Transaction?.replace(/,/g, "") || "0", 10),
        change,
        changePercent,
      };

      await prisma.dailyPrice.upsert({
        where: {
          symbol_date: { symbol, date: today },
        },
        update: priceData,
        create: { symbol, date: today, ...priceData },
      });

      upsertCount++;
    }

    await prisma.ingestionJob.create({
      data: {
        jobType: "sync_daily_prices",
        status: "SUCCESS",
        startedAt: new Date(),
        endedAt: new Date(),
        recordCount: upsertCount,
      },
    });

    console.log(`[syncDailyPrices] Done. ${upsertCount} records upserted.`);
  } catch (error) {
    console.error("[syncDailyPrices] Failed:", error);

    await prisma.ingestionJob.create({
      data: {
        jobType: "sync_daily_prices",
        status: "FAILED",
        startedAt: new Date(),
        endedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncDailyPrices().then(() => process.exit(0));
}
