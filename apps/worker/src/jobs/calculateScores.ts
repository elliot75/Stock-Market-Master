/**
 * Job: 計算推薦分數
 * 依賴: technical_snapshots, institutional_trades_daily, daily_prices, monthly_revenues
 * 排程: 每日 17:30 (Mon-Fri)
 *
 * 三層分數模型:
 * 1. 優質股分數 (quality_score) - 基本面為主
 * 2. 進場時機分數 (timing_score) - 技術面為主
 * 3. 風險分數 (risk_score) - 風險評估
 */
import { prisma, type RecommendationCategory } from "@repo/database";

export async function calculateScores() {
  console.log("[calculateScores] Starting...");

  try {
    const stocks = await prisma.stock.findMany({
      where: { status: "ACTIVE" },
      select: { symbol: true },
    });

    console.log(`[calculateScores] Processing ${stocks.length} stocks...`);

    let count = 0;

    for (const { symbol } of stocks) {
      // 取得最新收盤價
      const latestPrice = await prisma.dailyPrice.findFirst({
        where: { symbol },
        orderBy: { date: "desc" },
      });

      if (!latestPrice) continue;
      const snapshotDate = latestPrice.date;

      // 取得同一交易日的技術快照，避免假日或補資料時分數與行情錯位
      const tech = await prisma.technicalSnapshot.findUnique({
        where: { symbol_date: { symbol, date: snapshotDate } },
      });

      // 取得近 5 日法人買賣超
      const recentInstitutional = await prisma.institutionalTradeDaily.findMany(
        {
          where: { symbol },
          orderBy: { date: "desc" },
          take: 5,
        }
      );

      // 取得近 3 月營收
      const recentRevenues = await prisma.monthlyRevenue.findMany({
        where: { symbol },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: 3,
      });

      // ─── 1. 優質股分數 (基本面) ───
      let qualityScore = 50; // 基準分
      const analysisReasons: string[] = [];

      // 營收年增率加分
      const latestRevenue = recentRevenues[0];
      if (latestRevenue?.revenueYoY) {
        const yoy = Number(latestRevenue.revenueYoY);
        if (yoy > 30) {
          qualityScore += 20;
          analysisReasons.push(`營收年增 ${yoy.toFixed(1)}%，成長強勁`);
        } else if (yoy > 10) {
          qualityScore += 10;
          analysisReasons.push(`營收年增 ${yoy.toFixed(1)}%，穩定成長`);
        } else if (yoy < -10) {
          qualityScore -= 10;
          analysisReasons.push(`營收年增 ${yoy.toFixed(1)}%，衰退`);
        }
      }

      // ─── 2. 進場時機分數 (技術面) ───
      let timingScore = 50;

      // 均線多頭排列
      if (tech?.ma5 && tech?.ma20 && tech?.ma60) {
        const ma5 = Number(tech.ma5);
        const ma20 = Number(tech.ma20);
        const ma60 = Number(tech.ma60);
        if (ma5 > ma20 && ma20 > ma60) {
          timingScore += 15;
          analysisReasons.push("均線多頭排列 (MA5>MA20>MA60)");
        } else if (ma5 < ma20 && ma20 < ma60) {
          timingScore -= 15;
          analysisReasons.push("均線空頭排列");
        }
      }

      // KD 金叉 / 死叉
      if (tech?.kdK && tech?.kdD) {
        const k = Number(tech.kdK);
        const d = Number(tech.kdD);
        if (k > d && k < 30) {
          timingScore += 10;
          analysisReasons.push("KD 低檔金叉");
        } else if (k < d && k > 80) {
          timingScore -= 10;
          analysisReasons.push("KD 高檔死叉");
        }
      }

      // RSI
      if (tech?.rsi14) {
        const rsi = Number(tech.rsi14);
        if (rsi > 80) {
          timingScore -= 10;
          analysisReasons.push(`RSI(14) ${rsi.toFixed(1)}，超買區`);
        } else if (rsi < 20) {
          timingScore += 10;
          analysisReasons.push(`RSI(14) ${rsi.toFixed(1)}，超賣區`);
        }
      }

      // 法人買賣超
      if (recentInstitutional.length >= 3) {
        const totalForeignNet = recentInstitutional.reduce(
          (sum, t) => sum + Number(t.foreignNet),
          0
        );
        if (totalForeignNet > 0) {
          timingScore += 10;
          analysisReasons.push(
            `外資近 ${recentInstitutional.length} 日淨買 ${totalForeignNet} 張`
          );
        } else if (totalForeignNet < 0) {
          timingScore -= 5;
          analysisReasons.push(
            `外資近 ${recentInstitutional.length} 日淨賣 ${Math.abs(totalForeignNet)} 張`
          );
        }
      }

      // ─── 3. 風險分數 ───
      let riskScore = 30; // 基準

      // 乖離率過大 = 高風險
      if (tech?.bias20) {
        const bias = Number(tech.bias20);
        if (Math.abs(bias) > 15) {
          riskScore += 25;
          analysisReasons.push(`20日乖離率 ${bias.toFixed(1)}%，偏離過大`);
        } else if (Math.abs(bias) > 8) {
          riskScore += 10;
          analysisReasons.push(`20日乖離率 ${bias.toFixed(1)}%`);
        }
      }

      // 限制分數範圍 0~100
      qualityScore = Math.max(0, Math.min(100, qualityScore));
      timingScore = Math.max(0, Math.min(100, timingScore));
      riskScore = Math.max(0, Math.min(100, riskScore));

      // 綜合評分 (加權平均，風險越高越扣分)
      const compositeScore =
        qualityScore * 0.35 + timingScore * 0.4 + (100 - riskScore) * 0.25;

      // 決定推薦分類
      let category: RecommendationCategory;
      if (compositeScore >= 70 && riskScore <= 40) {
        category = "CORE_WATCH";
      } else if (compositeScore >= 55 && riskScore <= 55) {
        category = "PARTIAL_ENTRY";
      } else if (compositeScore >= 45) {
        category = "SHORT_TERM";
      } else {
        category = "HIGH_RISK";
      }

      await prisma.scoreSnapshot.upsert({
        where: { symbol_date: { symbol, date: snapshotDate } },
        update: {
          qualityScore,
          timingScore,
          riskScore,
          compositeScore,
          category,
          analysisJson: {
            reasons: analysisReasons,
            generatedAt: new Date().toISOString(),
          },
        },
        create: {
          symbol,
          date: snapshotDate,
          qualityScore,
          timingScore,
          riskScore,
          compositeScore,
          category,
          analysisJson: {
            reasons: analysisReasons,
            generatedAt: new Date().toISOString(),
          },
        },
      });

      count++;
    }

    await prisma.ingestionJob.create({
      data: {
        jobType: "calculate_scores",
        status: "SUCCESS",
        startedAt: new Date(),
        endedAt: new Date(),
        recordCount: count,
      },
    });

    console.log(`[calculateScores] Done. ${count} scores calculated.`);
  } catch (error) {
    console.error("[calculateScores] Failed:", error);

    await prisma.ingestionJob.create({
      data: {
        jobType: "calculate_scores",
        status: "FAILED",
        startedAt: new Date(),
        endedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  calculateScores().then(() => process.exit(0));
}
