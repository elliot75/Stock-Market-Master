/**
 * Screener Routes - 條件選股器
 */
import type { FastifyInstance } from "fastify";
import { prisma, Prisma } from "@repo/database";
import { z } from "zod";

const screenerSchema = z.object({
  // 基本面條件
  revenueYoYMin: z.number().optional(),     // 營收年增率 >= N%
  revenueYoYMax: z.number().optional(),     // 營收年增率 <= N%
  epsMin: z.number().optional(),            // EPS >= N
  grossMarginMin: z.number().optional(),    // 毛利率 >= N%
  roeMin: z.number().optional(),            // ROE >= N%
  // 技術面條件
  maCondition: z.enum(["bullish", "bearish", "any"]).optional(), // 均線排列
  rsiMin: z.number().optional(),
  rsiMax: z.number().optional(),
  kdCross: z.enum(["golden", "death", "any"]).optional(),
  // 籌碼面條件
  foreignNetDays: z.number().int().min(1).max(20).optional(), // 外資連買天數
  foreignNetDirection: z.enum(["buy", "sell"]).optional(),
  // 分數條件
  compositeScoreMin: z.number().optional(),
  qualityScoreMin: z.number().optional(),
  timingScoreMin: z.number().optional(),
  riskScoreMax: z.number().optional(),
  category: z.enum(["CORE_WATCH", "PARTIAL_ENTRY", "SHORT_TERM", "HIGH_RISK"]).optional(),
  // 產業與市場
  marketType: z.enum(["TWSE", "TPEX"]).optional(),
  industry: z.string().optional(),
  // 分頁
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export async function screenerRoutes(app: FastifyInstance) {
  // POST /api/screener
  app.post("/", async (request, reply) => {
    const body = screenerSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({
        error: "Validation Error",
        details: body.error.flatten().fieldErrors,
      });
    }

    const filters = body.data;

    // 取得最近交易日
    const latestDate = await prisma.scoreSnapshot.findFirst({
      orderBy: { date: "desc" },
      select: { date: true },
    });

    if (!latestDate) {
      return { data: [], meta: { total: 0 } };
    }

    // ─── Step 1: 從 score_snapshots 篩選基本分數條件 ───
    const scoreWhere: Prisma.ScoreSnapshotWhereInput = {
      date: latestDate.date,
    };

    if (filters.compositeScoreMin !== undefined) {
      scoreWhere.compositeScore = { gte: filters.compositeScoreMin };
    }
    if (filters.qualityScoreMin !== undefined) {
      scoreWhere.qualityScore = { gte: filters.qualityScoreMin };
    }
    if (filters.timingScoreMin !== undefined) {
      scoreWhere.timingScore = { gte: filters.timingScoreMin };
    }
    if (filters.riskScoreMax !== undefined) {
      scoreWhere.riskScore = { lte: filters.riskScoreMax };
    }
    if (filters.category) {
      scoreWhere.category = filters.category;
    }

    // 股票基本篩選
    const stockWhere: Prisma.StockWhereInput = {
      status: "ACTIVE",
    };
    if (filters.marketType) {
      stockWhere.marketType = filters.marketType;
    }
    if (filters.industry) {
      stockWhere.industry = { contains: filters.industry };
    }

    scoreWhere.stock = stockWhere;

    // 先取得符合分數條件的 symbols
    const scoreResults = await prisma.scoreSnapshot.findMany({
      where: scoreWhere,
      select: { symbol: true },
    });

    let candidateSymbols = scoreResults.map((s) => s.symbol);

    // ─── Step 2: 技術面篩選 ───
    if (
      filters.maCondition ||
      filters.rsiMin !== undefined ||
      filters.rsiMax !== undefined ||
      filters.kdCross
    ) {
      const techWhere: Prisma.TechnicalSnapshotWhereInput = {
        date: latestDate.date,
        symbol: { in: candidateSymbols },
      };

      if (filters.rsiMin !== undefined) {
        techWhere.rsi14 = { ...(techWhere.rsi14 as object || {}), gte: filters.rsiMin };
      }
      if (filters.rsiMax !== undefined) {
        techWhere.rsi14 = { ...(techWhere.rsi14 as object || {}), lte: filters.rsiMax };
      }

      const techResults = await prisma.technicalSnapshot.findMany({
        where: techWhere,
        select: {
          symbol: true,
          ma5: true,
          ma20: true,
          ma60: true,
          kdK: true,
          kdD: true,
        },
      });

      let filtered = techResults;

      // 均線排列篩選
      if (filters.maCondition === "bullish") {
        filtered = filtered.filter((t) => {
          const ma5 = Number(t.ma5 || 0);
          const ma20 = Number(t.ma20 || 0);
          const ma60 = Number(t.ma60 || 0);
          return ma5 > ma20 && ma20 > ma60;
        });
      } else if (filters.maCondition === "bearish") {
        filtered = filtered.filter((t) => {
          const ma5 = Number(t.ma5 || 0);
          const ma20 = Number(t.ma20 || 0);
          const ma60 = Number(t.ma60 || 0);
          return ma5 < ma20 && ma20 < ma60;
        });
      }

      // KD 交叉篩選
      if (filters.kdCross === "golden") {
        filtered = filtered.filter(
          (t) => Number(t.kdK || 0) > Number(t.kdD || 0)
        );
      } else if (filters.kdCross === "death") {
        filtered = filtered.filter(
          (t) => Number(t.kdK || 0) < Number(t.kdD || 0)
        );
      }

      candidateSymbols = filtered.map((t) => t.symbol);
    }

    // ─── Step 3: 籌碼面篩選 (外資連買/賣) ───
    if (filters.foreignNetDays && filters.foreignNetDirection) {
      const days = filters.foreignNetDays;
      const direction = filters.foreignNetDirection;
      const passed: string[] = [];

      for (const symbol of candidateSymbols) {
        const trades = await prisma.institutionalTradeDaily.findMany({
          where: { symbol },
          orderBy: { date: "desc" },
          take: days,
          select: { foreignNet: true },
        });

        if (trades.length < days) continue;

        const allMatch = trades.every((t) =>
          direction === "buy"
            ? Number(t.foreignNet) > 0
            : Number(t.foreignNet) < 0
        );

        if (allMatch) passed.push(symbol);
      }

      candidateSymbols = passed;
    }

    // ─── Step 4: 組裝結果 ───
    const total = candidateSymbols.length;
    const pagedSymbols = candidateSymbols.slice(
      filters.offset,
      filters.offset + filters.limit
    );

    // 批次取得完整資訊
    const [scores, prices] = await Promise.all([
      prisma.scoreSnapshot.findMany({
        where: {
          symbol: { in: pagedSymbols },
          date: latestDate.date,
        },
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
      prisma.dailyPrice.findMany({
        where: {
          symbol: { in: pagedSymbols },
          date: latestDate.date,
        },
      }),
    ]);

    const priceMap = new Map(prices.map((p) => [p.symbol, p]));

    const data = scores.map((s) => {
      const price = priceMap.get(s.symbol);
      return {
        symbol: s.symbol,
        name: s.stock.name,
        marketType: s.stock.marketType,
        industry: s.stock.industry,
        close: price ? Number(price.close) : null,
        change: price ? Number(price.change) : null,
        volume: price ? Number(price.volume) : null,
        compositeScore: Number(s.compositeScore),
        qualityScore: Number(s.qualityScore),
        timingScore: Number(s.timingScore),
        riskScore: Number(s.riskScore),
        category: s.category,
      };
    });

    return {
      data,
      meta: { total, limit: filters.limit, offset: filters.offset },
    };
  });
}
