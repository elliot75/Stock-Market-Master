import { fetch } from "undici";

async function test() {
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/2330.TW?range=1d&interval=1m";
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    }
  });
  const data = await res.json() as any;
  const result = data.chart.result[0];
  const meta = result.meta;
  console.log("Price:", meta.regularMarketPrice);
  console.log("Prev Close:", meta.previousClose);
}

test();
