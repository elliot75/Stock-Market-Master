/**
 * Job: 計算技術指標
 * 依賴: daily_prices 資料
 * 排程: 每日 17:00 (Mon-Fri)
 *
 * 計算項目: MA5/10/20/60/120/240, RSI(14), KD(9,3,3), MACD(12,26,9), 乖離率
 */
import { prisma } from "@repo/database";

// ─── 技術指標計算工具函式 ─────────────────────

function calcSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(0, period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcRSI(prices: number[], period: number = 14): number | null {
  if (prices.length < period + 1) return null;
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 0; i < period; i++) {
    const diff = prices[i] - prices[i + 1]; // newest first
    if (diff > 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }
  const avgGain = gainSum / period;
  const avgLoss = lossSum / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcKD(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 9
): { k: number; d: number } | null {
  if (closes.length < period) return null;
  const highSlice = highs.slice(0, period);
  const lowSlice = lows.slice(0, period);
  const highestHigh = Math.max(...highSlice);
  const lowestLow = Math.min(...lowSlice);

  if (highestHigh === lowestLow) return { k: 50, d: 50 };

  const rsv = ((closes[0] - lowestLow) / (highestHigh - lowestLow)) * 100;
  // 簡化版：用前一天 K 值估算，MVP 用 RSV 直接當 K
  const k = rsv;
  const d = k; // 後續可改為 3 日平滑
  return { k, d };
}

function calcMACD(
  prices: number[]
): { dif: number; dea: number; hist: number } | null {
  if (prices.length < 26) return null;
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);
  if (ema12 === null || ema26 === null) return null;
  const dif = ema12 - ema26;
  // 簡化版 DEA，完整版需歷史 DEA 序列
  const dea = dif * 0.2; // placeholder，正式版改為 signal line
  const hist = (dif - dea) * 2;
  return { dif, dea, hist };
}

function calcEMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  // 從最舊開始算
  const reversed = [...prices].reverse();
  let ema = reversed.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < reversed.length; i++) {
    ema = reversed[i] * k + ema * (1 - k);
  }
  return ema;
}

export async function calculateIndicators() {
  console.log("[calculateIndicators] Starting...");

  try {
    // 取得所有活躍股票
    const stocks = await prisma.stock.findMany({
      where: { status: "ACTIVE" },
      select: { symbol: true },
    });

    console.log(`[calculateIndicators] Processing ${stocks.length} stocks...`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

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

      const ma5 = calcSMA(closes, 5);
      const ma10 = calcSMA(closes, 10);
      const ma20 = calcSMA(closes, 20);
      const ma60 = calcSMA(closes, 60);
      const ma120 = calcSMA(closes, 120);
      const ma240 = calcSMA(closes, 240);
      const rsi14 = calcRSI(closes, 14);
      const kd = calcKD(highs, lows, closes, 9);
      const macd = calcMACD(closes);
      const bias5 =
        ma5 !== null ? ((closes[0] - ma5) / ma5) * 100 : null;
      const bias20 =
        ma20 !== null ? ((closes[0] - ma20) / ma20) * 100 : null;

      await prisma.technicalSnapshot.upsert({
        where: {
          symbol_date: { symbol, date: today },
        },
        update: {
          ma5, ma10, ma20, ma60, ma120, ma240,
          rsi14,
          kdK: kd?.k ?? null,
          kdD: kd?.d ?? null,
          macdDif: macd?.dif ?? null,
          macdDea: macd?.dea ?? null,
          macdHist: macd?.hist ?? null,
          bias5,
          bias20,
        },
        create: {
          symbol,
          date: today,
          ma5, ma10, ma20, ma60, ma120, ma240,
          rsi14,
          kdK: kd?.k ?? null,
          kdD: kd?.d ?? null,
          macdDif: macd?.dif ?? null,
          macdDea: macd?.dea ?? null,
          macdHist: macd?.hist ?? null,
          bias5,
          bias20,
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
