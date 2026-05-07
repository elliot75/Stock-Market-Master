/**
 * Job: 補齊歷史收盤價 (針對指定股票)
 * 來源: FinMind OpenAPI
 */
import { prisma } from "@repo/database";

const FINMIND_BASE = process.env.FINMIND_BASE_URL || "https://api.finmindtrade.com/api/v4/data";
const FINMIND_TOKEN = process.env.FINMIND_TOKEN;

// 台灣 50 成份股 (Top 50) + 幾支上櫃熱門股
const TOP_STOCKS = [
  "2330", "2317", "2454", "2382", "2308", "2881", "2882", "2891", "2412", "2886",
  "1216", "2002", "2884", "2892", "2885", "3231", "2303", "2880", "1301", "1303",
  "2883", "3045", "2357", "2379", "3034", "3711", "2395", "5871", "1101", "2887",
  "2890", "2207", "2603", "3008", "2345", "3019", "3702", "1102", "2324", "4938",
  "2609", "1590", "2301", "2912", "2615", "5876", "9910", "1326", "2356", "2385"
];

export async function seedHistoricalPrices() {
  console.log("[seedHistoricalPrices] Starting...");

  if (!FINMIND_TOKEN) {
    throw new Error("FINMIND_TOKEN is not defined in environment variables");
  }

  // 取過去 60 天的日期
  const d = new Date();
  d.setDate(d.getDate() - 60);
  const startDate = d.toISOString().split("T")[0];

  let totalUpserted = 0;

  for (const symbol of TOP_STOCKS) {
    try {
      console.log(`[seedHistoricalPrices] Fetching history for ${symbol}...`);
      const res = await fetch(
        `${FINMIND_BASE}?dataset=TaiwanStockPrice&data_id=${symbol}&start_date=${startDate}&token=${FINMIND_TOKEN}`
      );

      if (!res.ok) {
        console.error(`Error fetching ${symbol}: ${res.status}`);
        continue;
      }

      const data = await res.json();
      if (!data.data || !Array.isArray(data.data)) {
        continue;
      }

      const operations = [];
      // 排序確保由舊到新，計算 changePercent (雖然 FinMind 沒有提供前一天收盤價，但我們可以用 spread 算)
      const prices = data.data;

      for (let i = 0; i < prices.length; i++) {
        const row = prices[i];
        const dateObj = new Date(row.date);
        dateObj.setHours(0, 0, 0, 0);

        const close = row.close;
        const change = row.spread || 0;
        const prevClose = close - change;
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

        const priceData = {
          open: row.open || close,
          high: row.max || close,
          low: row.min || close,
          close,
          volume: BigInt(row.Trading_Volume || 0),
          turnover: BigInt(row.Trading_money || 0),
          transactionCount: parseInt(row.Trading_turnover || "0", 10),
          change,
          changePercent,
        };

        operations.push(
          prisma.dailyPrice.upsert({
            where: { symbol_date: { symbol, date: dateObj } },
            update: priceData,
            create: { symbol, date: dateObj, ...priceData },
          })
        );
      }

      // 批次寫入
      if (operations.length > 0) {
        await prisma.$transaction(operations);
        totalUpserted += operations.length;
      }
      
      // 避免 Rate limit，稍等 100ms
      await new Promise(r => setTimeout(r, 100));

    } catch (err) {
      console.error(`[seedHistoricalPrices] Failed for ${symbol}`, err);
    }
  }

  console.log(`[seedHistoricalPrices] Done. Upserted ${totalUpserted} daily prices.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedHistoricalPrices().then(() => process.exit(0));
}
