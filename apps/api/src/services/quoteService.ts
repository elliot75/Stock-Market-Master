import { prisma } from "@repo/database";

interface QuoteCacheEntry {
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

// Memory cache to prevent hitting Yahoo API too often
// Key: symbol (e.g., "2330"), Value: QuoteCacheEntry
const quoteCache = new Map<string, QuoteCacheEntry>();
const CACHE_TTL_MS = 15000; // 15 seconds

export async function getRealtimeQuotes(symbols: string[]): Promise<Record<string, QuoteCacheEntry>> {
  if (!symbols || symbols.length === 0) return {};

  const now = Date.now();
  const results: Record<string, QuoteCacheEntry> = {};
  const symbolsToFetch: string[] = [];

  // Check cache first
  for (const sym of symbols) {
    const cached = quoteCache.get(sym);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      results[sym] = cached;
    } else {
      symbolsToFetch.push(sym);
    }
  }

  // If all requested symbols are cached, return immediately
  if (symbolsToFetch.length === 0) {
    return results;
  }

  // Need to fetch missing or expired symbols
  try {
    const stocks = await prisma.stock.findMany({
      where: { symbol: { in: symbolsToFetch } },
      select: { symbol: true, marketType: true },
    });

    // 並行抓取所有符號 (v8/chart 接口較穩定)
    await Promise.all(symbolsToFetch.map(async (sym) => {
      try {
        const stock = stocks.find(s => s.symbol === sym);
        // 如果資料庫有標記則依據資料庫，否則預設先試 .TW
        const suffix = stock?.marketType === "TPEX" ? ".TWO" : ".TW";
        const yahooSymbol = `${sym}${suffix}`;
        
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=1d&interval=1m`;
        
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
        });

        if (!response.ok) return;

        const data = await response.json() as any;
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) return;

        const price = meta.regularMarketPrice || 0;
        const prevClose = meta.previousClose || price;
        const change = price - prevClose;
        const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

        const entry: QuoteCacheEntry = {
          price,
          change,
          changePercent,
          timestamp: now,
        };

        quoteCache.set(sym, entry);
        results[sym] = entry;
      } catch (e) {
        console.error(`[quoteService] Failed to fetch ${sym}:`, e);
      }
    }));

  } catch (err) {
    console.error("[quoteService] Error fetching quotes:", err);
  }

  return results;
}
