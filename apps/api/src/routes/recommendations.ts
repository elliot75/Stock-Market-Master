/**
 * Recommendation Routes - 首頁推薦清單
 */
import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/database";
import { summarizeBacktest } from "../lib/backtest.js";

export async function recommendationRoutes(app: FastifyInstance) {
  // GET /api/recommendations
  // Query: category, sort, limit, offset
  app.get("/", async (request, reply) => {
    const query = request.query as {
      category?: string;
      sort?: string;
      limit?: string;
      offset?: string;
    };

    const limit = Math.min(parseInt(query.limit || "50", 10), 100);
    const offset = parseInt(query.offset || "0", 10);

    // 取最近一個交易日的分數快照
    const latestDate = await prisma.scoreSnapshot.findFirst({
      orderBy: { date: "desc" },
      select: { date: true },
    });

    if (!latestDate) {
      return { data: [], meta: { total: 0, date: null } };
    }

    const where: Record<string, unknown> = {
      date: latestDate.date,
    };

    // 篩選推薦分類
    if (query.category) {
      const validCategories = [
        "CORE_WATCH",
        "PARTIAL_ENTRY",
        "SHORT_TERM",
        "HIGH_RISK",
      ];
      if (validCategories.includes(query.category)) {
        where.category = query.category;
      }
    }

    // 排序欄位
    type SortableField =
      | "compositeScore"
      | "qualityScore"
      | "timingScore"
      | "riskScore";
    const sortFieldMap: Record<string, SortableField> = {
      composite: "compositeScore",
      quality: "qualityScore",
      timing: "timingScore",
      risk: "riskScore",
    };
    const sortField = sortFieldMap[query.sort || "composite"] || "compositeScore";

    const [total, snapshots] = await Promise.all([
      prisma.scoreSnapshot.count({ where }),
      prisma.scoreSnapshot.findMany({
        where,
        orderBy: { [sortField]: sortField === "riskScore" ? "asc" : "desc" },
        take: limit,
        skip: offset,
        include: {
          stock: {
            select: {
              symbol: true,
              name: true,
              marketType: true,
              industry: true,
            },
          },
        },
      }),
    ]);

    // 取得最新報價 (用 daily_prices)
    const symbols = snapshots.map((s) => s.symbol);
    const [sameDatePrices, fallbackPrices] = await Promise.all([
      prisma.dailyPrice.findMany({
        where: {
          symbol: { in: symbols },
          date: latestDate.date,
        },
      }),
      prisma.dailyPrice.findMany({
        where: { symbol: { in: symbols } },
        orderBy: { date: "desc" },
        distinct: ["symbol"],
      }),
    ]);

    const priceMap = new Map(sameDatePrices.map((p) => [p.symbol, p]));
    const fallbackPriceMap = new Map(fallbackPrices.map((p) => [p.symbol, p]));

    const data = snapshots.map((s) => {
      const sameDatePrice = priceMap.get(s.symbol);
      const fallbackPrice = fallbackPriceMap.get(s.symbol);
      const price = sameDatePrice ?? fallbackPrice;
      return {
        symbol: s.symbol,
        name: s.stock.name,
        marketType: s.stock.marketType,
        industry: s.stock.industry,
        close: price ? Number(price.close) : null,
        change: price ? Number(price.change) : null,
        changePercent: price ? Number(price.changePercent) : null,
        volume: price ? Number(price.volume) : null,
        priceDate: price?.date ?? null,
        priceStatus: sameDatePrice ? "ok" : price ? "stale" : "missing",
        compositeScore: Number(s.compositeScore),
        qualityScore: Number(s.qualityScore),
        timingScore: Number(s.timingScore),
        riskScore: Number(s.riskScore),
        category: s.category,
        analysisJson: s.analysisJson,
      };
    });

    return {
      data,
      meta: {
        total,
        limit,
        offset,
        date: latestDate.date,
      },
    };
  });

  // GET /api/recommendations/summary
  // 取得各分類的數量統計
  app.get("/summary", async () => {
    const latestDate = await prisma.scoreSnapshot.findFirst({
      orderBy: { date: "desc" },
      select: { date: true },
    });

    if (!latestDate) {
      return { date: null, categories: {} };
    }

    const counts = await prisma.scoreSnapshot.groupBy({
      by: ["category"],
      where: { date: latestDate.date },
      _count: { category: true },
    });

    const categories: Record<string, number> = {};
    for (const c of counts) {
      if (c.category) {
        categories[c.category] = c._count.category;
      }
    }

    return { date: latestDate.date, categories };
  });

  // GET /api/recommendations/backtest
  // Query: category, horizon=5|20|60, from, to
  app.get("/backtest", async (request, reply) => {
    const query = request.query as {
      category?: string;
      horizon?: string;
      from?: string;
      to?: string;
    };
    const horizon = parseInt(query.horizon || "20", 10);
    if (![5, 20, 60].includes(horizon)) {
      return reply.code(400).send({ error: "horizon 僅支援 5、20、60" });
    }

    const where: Record<string, unknown> = {};
    if (
      query.category &&
      ["CORE_WATCH", "PARTIAL_ENTRY", "SHORT_TERM", "HIGH_RISK"].includes(query.category)
    ) {
      where.category = query.category;
    }

    const dateFilter: Record<string, Date> = {};
    if (query.from) dateFilter.gte = new Date(query.from);
    if (query.to) dateFilter.lte = new Date(query.to);
    if (Object.keys(dateFilter).length > 0) where.date = dateFilter;

    const snapshots = await prisma.scoreSnapshot.findMany({
      where,
      orderBy: [{ date: "asc" }, { compositeScore: "desc" }],
      take: 500,
      include: { stock: { select: { name: true } } },
    });

    const trades: Array<{
      symbol: string;
      name: string;
      date: Date;
      category: string | null;
      compositeScore: number | null;
      entryPrice: number;
      exitPrice: number;
      returnPercent: number;
      maxDrawdownPercent: number;
    }> = [];

    for (const snapshot of snapshots) {
      const prices = await prisma.dailyPrice.findMany({
        where: { symbol: snapshot.symbol, date: { gte: snapshot.date } },
        orderBy: { date: "asc" },
        take: horizon + 1,
      });
      if (prices.length < horizon + 1) continue;

      const entry = prices[0];
      const exit = prices[horizon];
      if (!entry || !exit) continue;

      const entryPrice = Number(entry.close);
      const exitPrice = Number(exit.close);
      if (entryPrice <= 0) continue;

      const lowestClose = Math.min(...prices.map((price) => Number(price.close)));
      trades.push({
        symbol: snapshot.symbol,
        name: snapshot.stock.name,
        date: snapshot.date,
        category: snapshot.category,
        compositeScore: snapshot.compositeScore != null ? Number(snapshot.compositeScore) : null,
        entryPrice,
        exitPrice,
        returnPercent: ((exitPrice - entryPrice) / entryPrice) * 100,
        maxDrawdownPercent: ((lowestClose - entryPrice) / entryPrice) * 100,
      });
    }

    const summary = summarizeBacktest(trades);

    return {
      meta: {
        horizon,
        ...summary,
      },
      data: trades.slice(0, 100),
    };
  });
}
