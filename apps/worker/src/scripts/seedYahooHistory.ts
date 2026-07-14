import "dotenv/config";
import { prisma } from "@repo/database";
import { fetch } from "undici";

/**
 * 獨立腳本：使用 Yahoo Finance 回填所有股票的歷史資料 (預設 1 年)
 * 執行方式：npm run script:seed-yahoo
 */
async function seedYahooHistory() {
  // 從命令列參數讀取 range，預設為 1y，支援 5d, 1mo, 3mo, 6mo, 1y 等
  const range = process.argv[2] || "1y";
  console.log(`🚀 [YahooSeed] 開始回填歷史資料 (範圍: ${range})...`);

  // 1. 從資料庫取得所有股票清單
  const stocks = await prisma.stock.findMany({
    select: { symbol: true, marketType: true, name: true },
  });

  console.log(`[YahooSeed] 找到 ${stocks.length} 檔股票，準備開始處理...`);

  let successCount = 0;
  let failCount = 0;

  for (const [i, stock] of stocks.entries()) {
    
    // Yahoo Finance 的台股代號後綴：上市為 .TW，上櫃為 .TWO
    const yahooSymbol = stock.marketType === "TWSE" 
      ? `${stock.symbol}.TW` 
      : `${stock.symbol}.TWO`;

    try {
      if (i % 50 === 0) {
        console.log(`[YahooSeed] 進度: ${i} / ${stocks.length} ...`);
      }

      // 抓取日 K 線資料 (range 支援 5d, 1mo, 3mo, 1y, 2y, 5y, max)
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=${range}&interval=1d`;
      
      const response = await fetch(url, {
        headers: {
          // 加上 User-Agent 避免被擋
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const data = await response.json() as any;
      const result = data?.chart?.result?.[0];

      if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
        // 沒有資料 (可能是下市、格式錯誤或剛上市)
        continue;
      }

      const timestamps = result.timestamp;
      const quote = result.indicators.quote[0];
      
      const operations = [];

      // 遍歷所有天數資料
      for (let j = 0; j < timestamps.length; j++) {
        // Yahoo 可能會出現 null (國定假日或其他原因)
        if (quote.close[j] === null || quote.open[j] === null) continue;

        const d = new Date(timestamps[j] * 1000);
        const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}T00:00:00.000Z`;
        const dateObj = new Date(dateStr);

        const open = Number(quote.open[j]);
        const high = Number(quote.high[j]);
        const low = Number(quote.low[j]);
        const close = Number(quote.close[j]);
        const volume = BigInt(quote.volume[j] || 0);

        // 計算漲跌 (與前一天的收盤價相比)
        let change = 0;
        let changePercent = 0;
        
        if (j > 0) {
          // 尋找前一個有效收盤價
          let prevClose = null;
          for (let k = j - 1; k >= 0; k--) {
            if (quote.close[k] !== null) {
              prevClose = Number(quote.close[k]);
              break;
            }
          }

          if (prevClose !== null && prevClose > 0) {
            change = close - prevClose;
            changePercent = (change / prevClose) * 100;
          }
        }

        operations.push(
          prisma.dailyPrice.upsert({
            where: { symbol_date: { symbol: stock.symbol, date: dateObj } },
            update: {
              open,
              high,
              low,
              close,
              volume,
              // Yahoo 無成交金額與筆數，補 0
              change,
              changePercent,
            },
            create: {
              symbol: stock.symbol,
              date: dateObj,
              open,
              high,
              low,
              close,
              volume,
              turnover: BigInt(0), 
              transactionCount: 0,
              change,
              changePercent,
            },
          })
        );
      }

      // 批次寫入資料庫
      if (operations.length > 0) {
        // 將大陣列拆小批次避免 Prisma 記憶體過載
        const BATCH_SIZE = 100;
        for (let k = 0; k < operations.length; k += BATCH_SIZE) {
          const chunk = operations.slice(k, k + BATCH_SIZE);
          await prisma.$transaction(chunk);
        }
      }
      
      successCount++;

      // 避免被 Yahoo Finance Rate Limit，每次請求間隔 150ms
      await new Promise(r => setTimeout(r, 150));

    } catch (err) {
      failCount++;
      console.error(`[YahooSeed] 抓取 ${stock.symbol} 失敗:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`✅ [YahooSeed] 執行完畢！`);
  console.log(`📊 成功: ${successCount} 檔, 失敗/無資料: ${failCount} 檔`);
}

// 直接執行腳本
seedYahooHistory()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("腳本執行發生未預期錯誤:", err);
    process.exit(1);
  });
