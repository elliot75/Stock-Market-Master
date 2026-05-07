/**
 * Job: 同步三大法人買賣超
 * 來源: TWSE OpenAPI 三大法人買賣超日報
 * 排程: 每日 16:30 (Mon-Fri)
 */
import { prisma } from "@repo/database";

const TWSE_BASE = process.env.TWSE_BASE_URL || "https://openapi.twse.com.tw";

export async function syncInstitutionalTrades() {
  console.log("[syncInstitutionalTrades] Starting...");

  try {
    // TWSE 三大法人買賣超日報 (個股)
    const res = await fetch(
      `${TWSE_BASE}/v1/exchangeReport/TWT38U_ALL`
    );

    if (!res.ok) {
      throw new Error(`TWSE institutional API error: ${res.status}`);
    }

    const data = (await res.json()) as Array<{
      Code: string;
      Name: string;
      Foreign_Investor_Buy: string;
      Foreign_Investor_Sell: string;
      Foreign_Investor_Overbought: string;
      Investment_Trust_Buy: string;
      Investment_Trust_Sell: string;
      Investment_Trust_Overbought: string;
      Dealer_Buy: string;
      Dealer_Sell: string;
      Dealer_Overbought: string;
    }>;

    console.log(`[syncInstitutionalTrades] ${data.length} records fetched`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let count = 0;

    for (const row of data) {
      const symbol = row.Code?.trim();
      if (!symbol) continue;

      const stockExists = await prisma.stock.findUnique({
        where: { symbol },
        select: { symbol: true },
      });
      if (!stockExists) continue;

      const parseBigInt = (s: string) =>
        BigInt((s || "0").replace(/,/g, ""));

      const foreignBuy = parseBigInt(row.Foreign_Investor_Buy);
      const foreignSell = parseBigInt(row.Foreign_Investor_Sell);
      const foreignNet = parseBigInt(row.Foreign_Investor_Overbought);
      const trustBuy = parseBigInt(row.Investment_Trust_Buy);
      const trustSell = parseBigInt(row.Investment_Trust_Sell);
      const trustNet = parseBigInt(row.Investment_Trust_Overbought);
      const dealerBuy = parseBigInt(row.Dealer_Buy);
      const dealerSell = parseBigInt(row.Dealer_Sell);
      const dealerNet = parseBigInt(row.Dealer_Overbought);
      const totalNet = foreignNet + trustNet + dealerNet;

      await prisma.institutionalTradeDaily.upsert({
        where: {
          symbol_date: { symbol, date: today },
        },
        update: {
          foreignBuy, foreignSell, foreignNet,
          trustBuy, trustSell, trustNet,
          dealerBuy, dealerSell, dealerNet,
          totalNet,
        },
        create: {
          symbol,
          date: today,
          foreignBuy, foreignSell, foreignNet,
          trustBuy, trustSell, trustNet,
          dealerBuy, dealerSell, dealerNet,
          totalNet,
        },
      });

      count++;
    }

    await prisma.ingestionJob.create({
      data: {
        jobType: "sync_institutional_trades",
        status: "SUCCESS",
        startedAt: new Date(),
        endedAt: new Date(),
        recordCount: count,
      },
    });

    console.log(`[syncInstitutionalTrades] Done. ${count} records.`);
  } catch (error) {
    console.error("[syncInstitutionalTrades] Failed:", error);

    await prisma.ingestionJob.create({
      data: {
        jobType: "sync_institutional_trades",
        status: "FAILED",
        startedAt: new Date(),
        endedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncInstitutionalTrades().then(() => process.exit(0));
}
