import { prisma } from "./index.js";

const requiredTables = [
  "users", "sessions", "stocks", "daily_prices", "technical_snapshots",
  "score_snapshots", "watchlists", "alert_rules", "alert_events",
  "notification_channels", "portfolio_holdings", "ingestion_jobs",
];

async function main() {
  const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ANY(${requiredTables})
  `;
  const present = new Set(rows.map((row: { table_name: string }) => row.table_name));
  const missing = requiredTables.filter((table) => !present.has(table));
  if (missing.length) throw new Error(`現有資料庫不符合 baseline，缺少資料表：${missing.join(", ")}`);
  console.log("Baseline schema check passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(() => prisma.$disconnect());
