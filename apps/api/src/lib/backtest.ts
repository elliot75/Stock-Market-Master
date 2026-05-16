export interface BacktestTrade {
  returnPercent: number;
  maxDrawdownPercent: number;
}

export function summarizeBacktest(trades: BacktestTrade[]) {
  const total = trades.length;
  const wins = trades.filter((trade) => trade.returnPercent > 0).length;
  return {
    total,
    winRate: total > 0 ? (wins / total) * 100 : 0,
    avgReturn:
      total > 0
        ? trades.reduce((sum, trade) => sum + trade.returnPercent, 0) / total
        : 0,
    maxDrawdown:
      total > 0 ? Math.min(...trades.map((trade) => trade.maxDrawdownPercent)) : 0,
  };
}
