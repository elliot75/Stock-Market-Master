import { prisma } from "@repo/database";

const stocks = [
  { symbol: "2330", name: "台積電", marketType: "TWSE", industry: "半導體業" },
  { symbol: "2317", name: "鴻海", marketType: "TWSE", industry: "其他電子業" },
  { symbol: "2454", name: "聯發科", marketType: "TWSE", industry: "半導體業" },
  { symbol: "2382", name: "廣達", marketType: "TWSE", industry: "電腦及週邊設備業" },
  { symbol: "2308", name: "台達電", marketType: "TWSE", industry: "電子零組件業" },
  { symbol: "2881", name: "富邦金", marketType: "TWSE", industry: "金融保險業" },
  { symbol: "2882", name: "國泰金", marketType: "TWSE", industry: "金融保險業" },
  { symbol: "2891", name: "中信金", marketType: "TWSE", industry: "金融保險業" },
  { symbol: "2412", name: "中華電", marketType: "TWSE", industry: "通信網路業" },
  { symbol: "2303", name: "聯電", marketType: "TWSE", industry: "半導體業" },
  { symbol: "2603", name: "長榮", marketType: "TWSE", industry: "航運業" },
  { symbol: "3008", name: "大立光", marketType: "TWSE", industry: "光電業" }
] as const;

async function main() {
  console.log("Seeding initial stock list...");
  for (const s of stocks) {
    await prisma.stock.upsert({
      where: { symbol: s.symbol },
      update: {},
      create: s,
    });
  }
  console.log("Done seeding stocks!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
