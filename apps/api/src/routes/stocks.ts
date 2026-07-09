/**
 * Stock Routes - 個股查詢、K線、深度分析
 */
import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/database";
import { getMacdSignal } from "../lib/technicalSignals.js";

export async function stockRoutes(app: FastifyInstance) {
  // GET /api/stocks/:symbol/overview
  // 個股基本資料 + 當日報價 + 最新分數
  app.get("/:symbol/overview", async (request, reply) => {
    const { symbol } = request.params as { symbol: string };

    const stock = await prisma.stock.findUnique({
      where: { symbol },
      include: {
        profile: true,
      },
    });

    if (!stock) {
      return reply.code(404).send({ error: `找不到股票 ${symbol}` });
    }

    // 最新收盤價
    const latestPrice = await prisma.dailyPrice.findFirst({
      where: { symbol },
      orderBy: { date: "desc" },
    });

    // 前一日收盤價 (算漲跌幅)
    const prevPrice = await prisma.dailyPrice.findFirst({
      where: { symbol },
      orderBy: { date: "desc" },
      skip: 1,
    });

    // 最新分數
    const latestScore = await prisma.scoreSnapshot.findFirst({
      where: { symbol },
      orderBy: { date: "desc" },
    });

    // 最近月營收
    const latestRevenue = await prisma.monthlyRevenue.findFirst({
      where: { symbol },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    return {
      stock: {
        symbol: stock.symbol,
        name: stock.name,
        marketType: stock.marketType,
        industry: stock.industry,
        profile: stock.profile
          ? {
              companyName: stock.profile.companyName,
              capital: stock.profile.capital
                ? Number(stock.profile.capital)
                : null,
              mainProducts: stock.profile.mainProducts,
              website: stock.profile.website,
            }
          : null,
      },
      price: latestPrice
        ? {
            date: latestPrice.date,
            open: Number(latestPrice.open),
            high: Number(latestPrice.high),
            low: Number(latestPrice.low),
            close: Number(latestPrice.close),
            volume: Number(latestPrice.volume),
            turnover: latestPrice.turnover
              ? Number(latestPrice.turnover)
              : null,
            change: Number(latestPrice.change),
            changePercent: latestPrice.changePercent
              ? Number(latestPrice.changePercent)
              : prevPrice
                ? (
                    ((Number(latestPrice.close) - Number(prevPrice.close)) /
                      Number(prevPrice.close)) *
                    100
                  )
                : null,
          }
        : null,
      score: latestScore
        ? {
            date: latestScore.date,
            compositeScore: Number(latestScore.compositeScore),
            qualityScore: Number(latestScore.qualityScore),
            timingScore: Number(latestScore.timingScore),
            riskScore: Number(latestScore.riskScore),
            category: latestScore.category,
            analysisJson: latestScore.analysisJson,
          }
        : null,
      revenue: latestRevenue
        ? {
            year: latestRevenue.year,
            month: latestRevenue.month,
            revenue: Number(latestRevenue.revenue),
            revenueYoY: latestRevenue.revenueYoY
              ? Number(latestRevenue.revenueYoY)
              : null,
          }
        : null,
    };
  });

  // GET /api/stocks/:symbol/chart
  // K 線圖資料 (OHLCV)
  // Query: timeframe (daily/weekly/monthly), days (預設120)
  app.get("/:symbol/chart", async (request, reply) => {
    const { symbol } = request.params as { symbol: string };
    const query = request.query as { timeframe?: string; days?: string };

    const days = Math.min(parseInt(query.days || "120", 10), 500);

    const stockExists = await prisma.stock.findUnique({
      where: { symbol },
      select: { symbol: true },
    });

    if (!stockExists) {
      return reply.code(404).send({ error: `找不到股票 ${symbol}` });
    }

    const dailyPrices = await prisma.dailyPrice.findMany({
      where: { symbol },
      orderBy: { date: "desc" },
      take: days,
    });

    // 反轉為時間正序
    const candles = dailyPrices.reverse().map((d) => ({
      date: d.date,
      open: Number(d.open),
      high: Number(d.high),
      low: Number(d.low),
      close: Number(d.close),
      volume: Number(d.volume),
    }));

    // 取得對應日期範圍的技術快照
    const dates = candles.map((c) => c.date);
    const techSnapshots = await prisma.technicalSnapshot.findMany({
      where: {
        symbol,
        date: { in: dates },
      },
      orderBy: { date: "asc" },
    });

    const techMap = new Map(
      techSnapshots.map((t) => [t.date.toISOString(), t])
    );

    const chartData = candles.map((c) => {
      const tech = techMap.get(c.date.toISOString());
      return {
        ...c,
        ma5: tech?.ma5 ? Number(tech.ma5) : null,
        ma10: tech?.ma10 ? Number(tech.ma10) : null,
        ma20: tech?.ma20 ? Number(tech.ma20) : null,
        ma60: tech?.ma60 ? Number(tech.ma60) : null,
      };
    });

    return { symbol, candles: chartData };
  });

  // GET /api/stocks/:symbol/analysis
  // 深度分析：技術面 + 籌碼面 + 基本面 + 操作建議
  app.get("/:symbol/analysis", async (request, reply) => {
    const { symbol } = request.params as { symbol: string };

    const stock = await prisma.stock.findUnique({
      where: { symbol },
      select: { symbol: true, name: true, industry: true },
    });

    if (!stock) {
      return reply.code(404).send({ error: `找不到股票 ${symbol}` });
    }

    // 最新技術快照
    const tech = await prisma.technicalSnapshot.findFirst({
      where: { symbol },
      orderBy: { date: "desc" },
    });

    // 最新分數快照
    const score = await prisma.scoreSnapshot.findFirst({
      where: { symbol },
      orderBy: { date: "desc" },
    });

    // 最近 10 日法人買賣超
    const institutional = await prisma.institutionalTradeDaily.findMany({
      where: { symbol },
      orderBy: { date: "desc" },
      take: 10,
    });

    // 最近 5 日收盤價 (量能分析)
    const recentPrices = await prisma.dailyPrice.findMany({
      where: { symbol },
      orderBy: { date: "desc" },
      take: 10,
    });

    // 最近 6 個月營收
    const revenues = await prisma.monthlyRevenue.findMany({
      where: { symbol },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 6,
    });

    // 最近財報
    const financials = await prisma.quarterlyFinancial.findFirst({
      where: { symbol },
      orderBy: [{ year: "desc" }, { quarter: "desc" }],
    });

    // 推薦快照 (操作建議)
    const recommendation = await prisma.recommendationSnapshot.findFirst({
      where: { symbol },
      orderBy: { date: "desc" },
    });

    // ─── 組裝技術分析總覽 ───
    const latestClose = recentPrices[0]
      ? Number(recentPrices[0].close)
      : null;

    const technicalSummary = tech
      ? {
          date: tech.date,
          trendDirection: determineTrend(tech),
          maStatus: getMaStatus(tech),
          ma5: tech.ma5 ? Number(tech.ma5) : null,
          ma20: tech.ma20 ? Number(tech.ma20) : null,
          ma60: tech.ma60 ? Number(tech.ma60) : null,
          kd: { k: tech.kdK ? Number(tech.kdK) : null, d: tech.kdD ? Number(tech.kdD) : null },
          kdSignal: getKdSignal(tech),
          macd: {
            dif: tech.macdDif ? Number(tech.macdDif) : null,
            dea: tech.macdDea ? Number(tech.macdDea) : null,
            hist: tech.macdHist ? Number(tech.macdHist) : null,
          },
          macdSignal: getMacdSignal(tech),
          rsi14: tech.rsi14 ? Number(tech.rsi14) : null,
          bias5: tech.bias5 ? Number(tech.bias5) : null,
          bias20: tech.bias20 ? Number(tech.bias20) : null,
        }
      : null;

    // ─── 組裝籌碼分析 ───
    const chipAnalysis = {
      recentDays: institutional.length,
      daily: institutional.map((t) => ({
        date: t.date,
        foreignNet: Number(t.foreignNet),
        trustNet: Number(t.trustNet),
        dealerNet: Number(t.dealerNet),
        totalNet: Number(t.totalNet),
      })),
      summary: {
        foreignTotal: institutional.reduce(
          (s, t) => s + Number(t.foreignNet),
          0
        ),
        trustTotal: institutional.reduce(
          (s, t) => s + Number(t.trustNet),
          0
        ),
        dealerTotal: institutional.reduce(
          (s, t) => s + Number(t.dealerNet),
          0
        ),
      },
    };

    // ─── 組裝量能分析 ───
    const latestRecentPrice = recentPrices[0];
    const volumeAnalysis =
      recentPrices.length >= 2 && latestRecentPrice
        ? {
            todayVolume: Number(latestRecentPrice.volume),
            avgVolume5:
              recentPrices.length >= 5
                ? Math.round(
                    recentPrices
                      .slice(0, 5)
                      .reduce((s, p) => s + Number(p.volume), 0) / 5
                  )
                : null,
            volumeChange:
              recentPrices.length >= 6
                ? (
                    (Number(latestRecentPrice.volume) /
                      (recentPrices
                        .slice(1, 6)
                        .reduce((s, p) => s + Number(p.volume), 0) /
                        5) -
                      1) *
                    100
                  ).toFixed(1) + "%"
                : null,
            priceVolumeRelation: getPriceVolumeRelation(recentPrices),
          }
        : null;

    // ─── 支撐壓力計算 ───
    const keyLevels = calculateKeyLevels(recentPrices, tech);

    // ─── 操作劇本 ───
    const scenarios = generateScenarios(latestClose, keyLevels);

    return {
      symbol: stock.symbol,
      name: stock.name,
      industry: stock.industry,
      technical: technicalSummary,
      chips: chipAnalysis,
      volume: volumeAnalysis,
      fundamentals: {
        revenues: revenues.map((r) => ({
          year: r.year,
          month: r.month,
          revenue: Number(r.revenue),
          yoy: r.revenueYoY ? Number(r.revenueYoY) : null,
        })),
        financial: financials
          ? {
              year: financials.year,
              quarter: financials.quarter,
              eps: financials.eps ? Number(financials.eps) : null,
              grossMargin: financials.grossMargin
                ? Number(financials.grossMargin)
                : null,
              roe: financials.roe ? Number(financials.roe) : null,
            }
          : null,
      },
      score: score
        ? {
            compositeScore: Number(score.compositeScore),
            qualityScore: Number(score.qualityScore),
            timingScore: Number(score.timingScore),
            riskScore: Number(score.riskScore),
            category: score.category,
            analysisJson: score.analysisJson,
          }
        : null,
      keyLevels,
      scenarios,
      recommendation: recommendation
        ? {
            title: recommendation.title,
            summary: recommendation.summary,
            supportPrice: recommendation.supportPrice
              ? Number(recommendation.supportPrice)
              : null,
            resistPrice: recommendation.resistPrice
              ? Number(recommendation.resistPrice)
              : null,
            stopLoss: recommendation.stopLoss
              ? Number(recommendation.stopLoss)
              : null,
          }
        : null,
    };
  });

  // GET /api/stocks/search?q=台積
  app.get("/search", async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q || q.length < 1) {
      return reply.code(400).send({ error: "請輸入搜尋關鍵字" });
    }

    const results = await prisma.stock.findMany({
      where: {
        OR: [
          { symbol: { contains: q } },
          { name: { contains: q } },
        ],
        status: "ACTIVE",
      },
      select: {
        symbol: true,
        name: true,
        marketType: true,
        industry: true,
      },
      take: 20,
    });

    return results;
  });
}

// ─── Helper Functions ──────────────────────────

function determineTrend(tech: {
  ma5: unknown;
  ma20: unknown;
  ma60: unknown;
}): string {
  const ma5 = Number(tech.ma5 || 0);
  const ma20 = Number(tech.ma20 || 0);
  const ma60 = Number(tech.ma60 || 0);
  if (!ma5 || !ma20 || !ma60) return "資料不足";
  if (ma5 > ma20 && ma20 > ma60) return "多頭趨勢";
  if (ma5 < ma20 && ma20 < ma60) return "空頭趨勢";
  if (ma5 > ma20 && ma20 < ma60) return "短多中空";
  return "盤整";
}

function getMaStatus(tech: {
  ma5: unknown;
  ma20: unknown;
  ma60: unknown;
}): string {
  const ma5 = Number(tech.ma5 || 0);
  const ma20 = Number(tech.ma20 || 0);
  const ma60 = Number(tech.ma60 || 0);
  if (ma5 > ma20 && ma20 > ma60) return "多頭排列 (5>20>60)";
  if (ma5 < ma20 && ma20 < ma60) return "空頭排列 (5<20<60)";
  return "糾結";
}

function getKdSignal(tech: { kdK: unknown; kdD: unknown }): string {
  const k = Number(tech.kdK || 50);
  const d = Number(tech.kdD || 50);
  if (k > 80 && d > 80) return "高檔鈍化";
  if (k < 20 && d < 20) return "低檔超賣";
  if (k > d) return "K 上穿 D (偏多)";
  if (k < d) return "K 下穿 D (偏空)";
  return "中性";
}

interface PriceRow {
  close: unknown;
  volume: unknown;
}

function getPriceVolumeRelation(prices: PriceRow[]): string {
  if (prices.length < 2) return "資料不足";
  const today = prices[0];
  const previous = prices[1];
  if (!today || !previous) return "資料不足";
  const todayClose = Number(today.close);
  const prevClose = Number(previous.close);
  const todayVol = Number(today.volume);
  const prevVol = Number(previous.volume);

  const priceUp = todayClose > prevClose;
  const volUp = todayVol > prevVol * 1.2;
  const volDown = todayVol < prevVol * 0.8;

  if (priceUp && volUp) return "價漲量增";
  if (priceUp && volDown) return "價漲量縮";
  if (!priceUp && volUp) return "價跌量增";
  if (!priceUp && volDown) return "價跌量縮";
  return "量能持平";
}

interface KeyLevels {
  resistance1: number | null;
  resistance2: number | null;
  support1: number | null;
  support2: number | null;
  stopLoss: number | null;
}

function calculateKeyLevels(
  prices: Array<{ high: unknown; low: unknown; close: unknown }>,
  tech: { ma20: unknown; ma60: unknown } | null
): KeyLevels {
  if (prices.length < 5)
    return {
      resistance1: null,
      resistance2: null,
      support1: null,
      support2: null,
      stopLoss: null,
    };

  const recentHighs = prices.slice(0, 20).map((p) => Number(p.high));
  const recentLows = prices.slice(0, 20).map((p) => Number(p.low));
  const latest = prices[0];
  if (!latest) {
    return {
      resistance1: null,
      resistance2: null,
      support1: null,
      support2: null,
      stopLoss: null,
    };
  }
  const latestClose = Number(latest.close);

  const highestHigh = Math.max(...recentHighs);
  const lowestLow = Math.min(...recentLows);
  const ma20 = tech?.ma20 ? Number(tech.ma20) : null;
  const ma60 = tech?.ma60 ? Number(tech.ma60) : null;

  return {
    resistance1: Math.round(highestHigh),
    resistance2: Math.round(highestHigh * 1.05),
    support1: ma20 ? Math.round(ma20) : Math.round(latestClose * 0.95),
    support2: ma60 ? Math.round(ma60) : Math.round(lowestLow),
    stopLoss: Math.round(lowestLow * 0.97),
  };
}

interface Scenario {
  name: string;
  condition: string;
  entry: string;
  stopLoss: string;
  target: string;
}

function generateScenarios(
  close: number | null,
  levels: KeyLevels
): Scenario[] {
  if (!close || !levels.resistance1 || !levels.support1) return [];

  return [
    {
      name: "① 開高走高",
      condition: `突破 ${levels.resistance1}`,
      entry: `${levels.resistance1} ~ ${Math.round(levels.resistance1 * 1.01)}`,
      stopLoss: `${Math.round(close * 0.97)}`,
      target: `${levels.resistance2 || Math.round(levels.resistance1 * 1.05)}`,
    },
    {
      name: "② 震盪整理",
      condition: `在 ${levels.support1} ~ ${levels.resistance1} 區間`,
      entry: `回測 ${levels.support1} 附近`,
      stopLoss: `${Math.round(levels.support1 * 0.97)}`,
      target: `${levels.resistance1}`,
    },
    {
      name: "③ 開低走弱",
      condition: `跌破 ${levels.support1}`,
      entry: `觀望，等待 ${levels.support2} 支撐確認`,
      stopLoss: `${levels.stopLoss}`,
      target: `反彈至 ${levels.support1}`,
    },
  ];
}
