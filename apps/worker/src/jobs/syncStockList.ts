/**
 * Job: 同步上市櫃股票清單
 * 來源: FinMind OpenAPI
 * 排程: 每日 15:00 (Mon-Fri)
 */
import { prisma } from "@repo/database";

const FINMIND_BASE = process.env.FINMIND_BASE_URL || "https://api.finmindtrade.com/api/v4/data";
const FINMIND_TOKEN = process.env.FINMIND_TOKEN;

export async function syncStockList() {
  console.log("[syncStockList] Starting...");

  if (!FINMIND_TOKEN) {
    throw new Error("FINMIND_TOKEN is not defined in environment variables");
  }

  try {
    const res = await fetch(
      `${FINMIND_BASE}?dataset=TaiwanStockInfo&token=${FINMIND_TOKEN}`
    );

    if (!res.ok) {
      throw new Error(`FinMind API error: ${res.status}`);
    }

    const data = await res.json();
    if (data.msg !== "success" || !data.data) {
      throw new Error(`FinMind API format error: ${JSON.stringify(data)}`);
    }

    const stocks = data.data as Array<{
      industry_category: string;
      stock_id: string;
      stock_name: string;
      type: string;
      date: string;
    }>;

    console.log(`[syncStockList] FinMind: ${stocks.length} stocks fetched`);

    const operations = [];
    for (const s of stocks) {
      if (s.type !== "twse" && s.type !== "tpex") continue;
      if (s.stock_id.length > 4 && s.type !== "twse" && s.type !== "tpex") continue;

      const marketType = s.type === "twse" ? "TWSE" : "TPEX";
      const industry = s.industry_category?.trim();
      const industryValue = industry && industry !== "" && industry !== "nan" ? industry : null;

      operations.push(
        prisma.stock.upsert({
          where: { symbol: s.stock_id.trim() },
          update: {
            name: s.stock_name.trim(),
            industry: industryValue,
            marketType,
          },
          create: {
            symbol: s.stock_id.trim(),
            name: s.stock_name.trim(),
            industry: industryValue,
            marketType,
          },
        })
      );
    }

    // 分批執行
    const chunkSize = 500;
    let count = 0;
    for (let i = 0; i < operations.length; i += chunkSize) {
      const chunk = operations.slice(i, i + chunkSize);
      await prisma.$transaction(chunk);
      count += chunk.length;
      console.log(`[syncStockList] Upserted ${count}/${operations.length}`);
    }

    // 5. 紀錄 ingestion job
    await prisma.ingestionJob.create({
      data: {
        jobType: "sync_stock_list",
        status: "SUCCESS",
        startedAt: new Date(),
        endedAt: new Date(),
        recordCount: count,
      },
    });

    console.log(`[syncStockList] Done. Upserted ${count} stocks.`);
  } catch (error) {
    console.error("[syncStockList] Failed:", error);

    await prisma.ingestionJob.create({
      data: {
        jobType: "sync_stock_list",
        status: "FAILED",
        startedAt: new Date(),
        endedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

// 支援直接執行 (npm run job:sync-stocks)
if (import.meta.url === `file://${process.argv[1]}`) {
  syncStockList().then(() => process.exit(0));
}
