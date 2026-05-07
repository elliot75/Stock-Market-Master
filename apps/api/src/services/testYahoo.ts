import { fetch } from "undici";

async function test() {
  const url = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=2330.TW";
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

test();
