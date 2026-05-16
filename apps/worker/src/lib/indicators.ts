export interface IndicatorInput {
  closes: number[];
  highs: number[];
  lows: number[];
}

export interface IndicatorResult {
  ma5: number | null;
  ma10: number | null;
  ma20: number | null;
  ma60: number | null;
  ma120: number | null;
  ma240: number | null;
  rsi14: number | null;
  kdK: number | null;
  kdD: number | null;
  macdDif: number | null;
  macdDea: number | null;
  macdHist: number | null;
  bias5: number | null;
  bias20: number | null;
}

export function calcSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(0, period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function calcRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 0; i < period; i++) {
    const current = prices[i];
    const previous = prices[i + 1];
    if (current === undefined || previous === undefined) return null;
    const diff = current - previous;
    if (diff > 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }
  const avgGain = gainSum / period;
  const avgLoss = lossSum / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function calcKD(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 9
): { k: number; d: number } | null {
  if (closes.length < period || highs.length < period || lows.length < period) {
    return null;
  }

  const oldestHighs = [...highs].reverse();
  const oldestLows = [...lows].reverse();
  const oldestCloses = [...closes].reverse();
  let k = 50;
  let d = 50;
  let hasValue = false;

  for (let i = period - 1; i < oldestCloses.length; i++) {
    const highWindow = oldestHighs.slice(i - period + 1, i + 1);
    const lowWindow = oldestLows.slice(i - period + 1, i + 1);
    const close = oldestCloses[i];
    if (close === undefined) return null;

    const highestHigh = Math.max(...highWindow);
    const lowestLow = Math.min(...lowWindow);
    const rsv =
      highestHigh === lowestLow
        ? 50
        : ((close - lowestLow) / (highestHigh - lowestLow)) * 100;

    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
    hasValue = true;
  }

  return hasValue ? { k, d } : null;
}

export function calcEMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  const oldestFirst = [...prices].reverse();
  let ema = oldestFirst.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < oldestFirst.length; i++) {
    const price = oldestFirst[i];
    if (price === undefined) return null;
    ema = price * k + ema * (1 - k);
  }

  return ema;
}

function calcEMASeries(oldestFirst: number[], period: number): Array<number | null> {
  const series: Array<number | null> = Array(oldestFirst.length).fill(null);
  if (oldestFirst.length < period) return series;

  const k = 2 / (period + 1);
  let ema = oldestFirst.slice(0, period).reduce((a, b) => a + b, 0) / period;
  series[period - 1] = ema;

  for (let i = period; i < oldestFirst.length; i++) {
    const price = oldestFirst[i];
    if (price === undefined) break;
    ema = price * k + ema * (1 - k);
    series[i] = ema;
  }

  return series;
}

export function calcMACD(
  prices: number[]
): { dif: number; dea: number; hist: number } | null {
  if (prices.length < 35) return null;

  const oldestFirst = [...prices].reverse();
  const ema12 = calcEMASeries(oldestFirst, 12);
  const ema26 = calcEMASeries(oldestFirst, 26);
  const difSeries: Array<number | null> = oldestFirst.map((_, i) => {
    const fast = ema12[i];
    const slow = ema26[i];
    return fast == null || slow == null ? null : fast - slow;
  });
  const difValues = difSeries.filter((value): value is number => value != null);
  if (difValues.length < 9) return null;

  const signalSeries = calcEMASeries(difValues, 9);
  const dif = difValues[difValues.length - 1];
  const dea = signalSeries[signalSeries.length - 1];
  if (dif === undefined || dea == null) return null;

  return { dif, dea, hist: (dif - dea) * 2 };
}

export function calculateIndicatorSet(input: IndicatorInput): IndicatorResult {
  const { closes, highs, lows } = input;
  const ma5 = calcSMA(closes, 5);
  const ma10 = calcSMA(closes, 10);
  const ma20 = calcSMA(closes, 20);
  const ma60 = calcSMA(closes, 60);
  const ma120 = calcSMA(closes, 120);
  const ma240 = calcSMA(closes, 240);
  const rsi14 = calcRSI(closes, 14);
  const kd = calcKD(highs, lows, closes, 9);
  const macd = calcMACD(closes);
  const latestClose = closes[0];

  return {
    ma5,
    ma10,
    ma20,
    ma60,
    ma120,
    ma240,
    rsi14,
    kdK: kd?.k ?? null,
    kdD: kd?.d ?? null,
    macdDif: macd?.dif ?? null,
    macdDea: macd?.dea ?? null,
    macdHist: macd?.hist ?? null,
    bias5: ma5 !== null && latestClose !== undefined ? ((latestClose - ma5) / ma5) * 100 : null,
    bias20: ma20 !== null && latestClose !== undefined ? ((latestClose - ma20) / ma20) * 100 : null,
  };
}
