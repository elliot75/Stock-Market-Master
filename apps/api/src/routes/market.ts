/**
 * Market Routes - 市場總覽
 */
import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/database";

export async function marketRoutes(app: FastifyInstance) {
  // GET /api/market/overview - 市場總覽
  app.get("/overview", async () => {
    // 取得最近交易日
    const latestDate = await prisma.dailyPrice.findFirst({
      orderBy: { date: "desc" },
      select: { date: true },
    });

    if (!latestDate) {
      return { date: null, summary: null };
    }

    // 漲跌家數統計
    const allPrices = await prisma.dailyPrice.findMany({
      where: { date: latestDate.date },
      select: { symbol: true, change: true, volume: true, close: true },
    });

    let upCount = 0;
    let downCount = 0;
    let flatCount = 0;
    let totalVolume = BigInt(0);

    for (const p of allPrices) {
      const change = Number(p.change || 0);
      if (change > 0) upCount++;
      else if (change < 0) downCount++;
      else flatCount++;
      totalVolume += BigInt(p.volume || 0);
    }

    // 成交量前 10 名
    const topVolume = await prisma.dailyPrice.findMany({
      where: { date: latestDate.date },
      orderBy: { volume: "desc" },
      take: 10,
      include: {
        stock: { select: { name: true, industry: true } },
      },
    });

    // 漲幅前 10 名
    const topGainers = await prisma.dailyPrice.findMany({
      where: {
        date: latestDate.date,
        changePercent: { not: null },
      },
      orderBy: { changePercent: "desc" },
      take: 10,
      include: {
        stock: { select: { name: true, industry: true } },
      },
    });

    // 跌幅前 10 名
    const topLosers = await prisma.dailyPrice.findMany({
      where: {
        date: latestDate.date,
        changePercent: { not: null },
      },
      orderBy: { changePercent: "asc" },
      take: 10,
      include: {
        stock: { select: { name: true, industry: true } },
      },
    });

    const formatPrice = (p: typeof topVolume[0]) => ({
      symbol: p.symbol,
      name: p.stock.name,
      industry: p.stock.industry,
      close: Number(p.close),
      change: Number(p.change),
      changePercent: p.changePercent ? Number(p.changePercent) : null,
      volume: Number(p.volume),
    });

    return {
      date: latestDate.date,
      summary: {
        totalStocks: allPrices.length,
        upCount,
        downCount,
        flatCount,
        totalVolume: totalVolume.toString(),
      },
      topVolume: topVolume.map(formatPrice),
      topGainers: topGainers.map(formatPrice),
      topLosers: topLosers.map(formatPrice),
    };
  });

  // GET /api/market/industries - 產業族群統計
  app.get("/industries", async () => {
    const latestDate = await prisma.dailyPrice.findFirst({
      orderBy: { date: "desc" },
      select: { date: true },
    });

    if (!latestDate) return [];

    // 取得所有股票的產業分類與當日漲跌
    const stocksWithPrices = await prisma.dailyPrice.findMany({
      where: { date: latestDate.date },
      select: {
        change: true,
        changePercent: true,
        volume: true,
        stock: { select: { industry: true } },
      },
    });

    // 按產業分組統計
    const industryMap = new Map<
      string,
      { upCount: number; downCount: number; totalChange: number; count: number }
    >();

    for (const sp of stocksWithPrices) {
      const industry = sp.stock.industry || "其他";
      if (!industryMap.has(industry)) {
        industryMap.set(industry, {
          upCount: 0,
          downCount: 0,
          totalChange: 0,
          count: 0,
        });
      }
      const stats = industryMap.get(industry)!;
      const change = Number(sp.change || 0);
      if (change > 0) stats.upCount++;
      else if (change < 0) stats.downCount++;
      stats.totalChange += Number(sp.changePercent || 0);
      stats.count++;
    }

    const result = Array.from(industryMap.entries())
      .map(([name, stats]) => ({
        industry: name,
        stockCount: stats.count,
        upCount: stats.upCount,
        downCount: stats.downCount,
        avgChangePercent: (stats.totalChange / stats.count).toFixed(2),
      }))
      .sort((a, b) => parseFloat(b.avgChangePercent) - parseFloat(a.avgChangePercent));

    return result;
  });
}
