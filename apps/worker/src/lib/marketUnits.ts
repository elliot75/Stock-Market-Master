export function formatSharesAsLots(shares: number): string {
  if (!Number.isFinite(shares)) return "0 張";

  const lots = shares / 1000;
  const fractionDigits = Math.abs(lots) >= 10 || Number.isInteger(lots) ? 0 : 1;
  return `${lots.toLocaleString("en-US", {
    maximumFractionDigits: fractionDigits,
  })} 張`;
}
