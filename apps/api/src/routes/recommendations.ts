/**
 * Recommendation Routes - 首頁推薦清單
 */
import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/database";

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
    const latestPrices = await prisma.dailyPrice.findMany({
      where: {
        symbol: { in: symbols },
        date: latestDate.date,
      },
    });

    const priceMap = new Map(latestPrices.map((p) => [p.symbol, p]));

    const data = snapshots.map((s) => {
      const price = priceMap.get(s.symbol);
      return {
        symbol: s.symbol,
        name: s.stock.name,
        marketType: s.stock.marketType,
        industry: s.stock.industry,
        close: price ? Number(price.close) : null,
        change: price ? Number(price.change) : null,
        changePercent: price ? Number(price.changePercent) : null,
        volume: price ? Number(price.volume) : null,
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
}
