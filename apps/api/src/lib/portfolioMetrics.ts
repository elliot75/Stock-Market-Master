export function calculateHoldingMetrics(params: {
  shares: number;
  averageCost: number;
  latestPrice: number | null;
}) {
  const costValue = params.shares * params.averageCost;
  const marketValue =
    params.latestPrice != null ? params.shares * params.latestPrice : null;
  const unrealizedPnl = marketValue != null ? marketValue - costValue : null;
  const unrealizedPnlPercent =
    unrealizedPnl != null && costValue > 0 ? (unrealizedPnl / costValue) * 100 : null;

  return { costValue, marketValue, unrealizedPnl, unrealizedPnlPercent };
}
