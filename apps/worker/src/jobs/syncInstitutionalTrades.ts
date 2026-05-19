/**
 * Job: 同步三大法人買賣超
 * 來源: TWSE 交易資訊 T86 三大法人買賣超日報
 * 排程: 每日 16:30 (Mon-Fri)
 */
import { prisma } from "@repo/database";

const TWSE_WEB_BASE = process.env.TWSE_WEB_BASE_URL || "https://www.twse.com.tw";

type TwseT86Response = {
  stat?: string;
  date?: string;
  title?: string;
  fields?: string[];
  data?: string[][];
};

function formatTwseDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function parseTwseDate(date: string): Date {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(4, 6));
  const day = Number(date.slice(6, 8));
  return new Date(Date.UTC(year, month - 1, day));
}

function parseBigInt(value: string | undefined): bigint {
  return BigInt((value || "0").replace(/,/g, ""));
}

async function readJsonResponse<T>(res: Response, url: string): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    throw new Error(
      `TWSE institutional API returned non-JSON from ${url}. content-type=${res.headers.get(
        "content-type"
      ) || "unknown"}, body=${trimmed.slice(0, 120)}`
    );
  }
  return JSON.parse(trimmed) as T;
}

export async function syncInstitutionalTrades() {
  console.log("[syncInstitutionalTrades] Starting...");

  try {
    const latestPrice = await prisma.dailyPrice.findFirst({
      orderBy: { date: "desc" },
      select: { date: true },
    });
    const queryDate = formatTwseDate(latestPrice?.date ?? new Date());
    const url = `${TWSE_WEB_BASE}/rwd/zh/fund/T86?date=${queryDate}&selectType=ALLBUT0999&response=json`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json,text/plain,*/*",
        "User-Agent": "Mozilla/5.0 (compatible; Stock-Market-Master/1.0)",
      },
    });

    if (!res.ok) {
      throw new Error(`TWSE institutional API error: ${res.status}`);
    }

    const payload = await readJsonResponse<TwseT86Response>(res, url);
    if (payload.stat !== "OK" || !payload.date || !Array.isArray(payload.data)) {
      throw new Error(
        `TWSE institutional API format error: stat=${payload.stat || "unknown"}, title=${
          payload.title || "unknown"
        }`
      );
    }

    const data = payload.data;
    const tradeDate = parseTwseDate(payload.date);
    console.log(
      `[syncInstitutionalTrades] ${data.length} records fetched for ${payload.date}`
    );

    let count = 0;

    for (const row of data) {
      const symbol = row[0]?.trim();
      if (!symbol) continue;

      const stockExists = await prisma.stock.findUnique({
        where: { symbol },
        select: { symbol: true },
      });
      if (!stockExists) continue;

      const foreignBuy = parseBigInt(row[2]);
      const foreignSell = parseBigInt(row[3]);
      const foreignNet = parseBigInt(row[4]);
      const trustBuy = parseBigInt(row[8]);
      const trustSell = parseBigInt(row[9]);
      const trustNet = parseBigInt(row[10]);
      const dealerBuy = parseBigInt(row[12]) + parseBigInt(row[15]);
      const dealerSell = parseBigInt(row[13]) + parseBigInt(row[16]);
      const dealerNet = parseBigInt(row[11]);
      const totalNet = parseBigInt(row[18]);

      await prisma.institutionalTradeDaily.upsert({
        where: {
          symbol_date: { symbol, date: tradeDate },
        },
        update: {
          foreignBuy, foreignSell, foreignNet,
          trustBuy, trustSell, trustNet,
          dealerBuy, dealerSell, dealerNet,
          totalNet,
        },
        create: {
          symbol,
          date: tradeDate,
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
        metadata: { date: payload.date, source: "TWSE_T86" },
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
