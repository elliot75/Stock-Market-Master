import "dotenv/config";
import cron from "node-cron";

console.log("🔄 Stock Market Master Worker started");
console.log(`⏰ Timezone: ${process.env.WORKER_TIMEZONE || "Asia/Taipei"}`);

const TZ = process.env.WORKER_TIMEZONE || "Asia/Taipei";

// ─── 排程定義 ──────────────────────────────────
// 所有時間以台北時區為基準

// 15:00 - 同步上市櫃股票清單 (每日)
cron.schedule(
  "0 15 * * 1-5",
  async () => {
    console.log("[Job] Sync stock list...");
    const { syncStockList } = await import("./jobs/syncStockList.js");
    await syncStockList();
  },
  { timezone: TZ }
);

// 15:30 - 同步當日收盤價 (每日)
cron.schedule(
  "30 15 * * 1-5",
  async () => {
    console.log("[Job] Sync daily prices...");
    const { syncDailyPrices } = await import("./jobs/syncDailyPrices.js");
    await syncDailyPrices();
  },
  { timezone: TZ }
);

// 16:30 - 同步三大法人買賣超 (每日)
cron.schedule(
  "30 16 * * 1-5",
  async () => {
    console.log("[Job] Sync institutional trades...");
    const { syncInstitutionalTrades } = await import(
      "./jobs/syncInstitutionalTrades.js"
    );
    await syncInstitutionalTrades();
  },
  { timezone: TZ }
);

// 17:00 - 計算技術指標 (每日)
cron.schedule(
  "0 17 * * 1-5",
  async () => {
    console.log("[Job] Calculate technical indicators...");
    const { calculateIndicators } = await import(
      "./jobs/calculateIndicators.js"
    );
    await calculateIndicators();
  },
  { timezone: TZ }
);

// 17:30 - 計算推薦分數 (每日)
cron.schedule(
  "30 17 * * 1-5",
  async () => {
    console.log("[Job] Calculate scores...");
    const { calculateScores } = await import("./jobs/calculateScores.js");
    await calculateScores();
  },
  { timezone: TZ }
);

// 18:00 - 檢查提醒觸發 (每日)
cron.schedule(
  "0 18 * * 1-5",
  async () => {
    console.log("[Job] Check alert rules...");
    const { checkAlerts } = await import("./jobs/checkAlerts.js");
    await checkAlerts();
  },
  { timezone: TZ }
);

// 盤中價位型提醒：每 5 分鐘，09:00–13:35（台北時間）
for (const expression of ["*/5 9-12 * * 1-5", "0,5,10,15,20,25,30,35 13 * * 1-5"]) {
  cron.schedule(expression, async () => {
    const { checkIntradayAlerts } = await import("./jobs/checkIntradayAlerts.js");
    await checkIntradayAlerts();
  }, { timezone: TZ });
}

// 清除超過保留期限的私人 AI 對話與不再使用的報告
cron.schedule("30 2 * * *", async () => {
  const { cleanupAiData } = await import("./jobs/cleanupAiData.js");
  await cleanupAiData();
}, { timezone: TZ });

console.log("✅ All cron jobs scheduled (Mon-Fri, Asia/Taipei)");
