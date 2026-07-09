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

export interface PortfolioReviewHolding {
  symbol: string;
  industry: string | null;
  marketValue: number | null;
}

export function summarizePortfolioReview(holdings: PortfolioReviewHolding[]) {
  const valuedHoldings = holdings
    .map((holding) => ({
      ...holding,
      marketValue: holding.marketValue ?? 0,
    }))
    .filter((holding) => holding.marketValue > 0);

  const totalMarketValue = valuedHoldings.reduce(
    (sum, holding) => sum + holding.marketValue,
    0
  );

  const sortedByValue = [...valuedHoldings].sort(
    (a, b) => b.marketValue - a.marketValue
  );
  const topHolding = sortedByValue[0] ?? null;
  const topHoldingPercent =
    topHolding && totalMarketValue > 0
      ? (topHolding.marketValue / totalMarketValue) * 100
      : 0;
  const topThreePercent =
    totalMarketValue > 0
      ? (sortedByValue.slice(0, 3).reduce((sum, holding) => sum + holding.marketValue, 0) /
          totalMarketValue) *
        100
      : 0;

  const industryMap = new Map<string, number>();
  for (const holding of valuedHoldings) {
    const industry = holding.industry || "未分類";
    industryMap.set(industry, (industryMap.get(industry) ?? 0) + holding.marketValue);
  }

  const industryExposure = Array.from(industryMap.entries())
    .map(([industry, marketValue]) => ({
      industry,
      marketValue,
      percent: totalMarketValue > 0 ? (marketValue / totalMarketValue) * 100 : 0,
    }))
    .sort((a, b) => b.marketValue - a.marketValue);

  const concentrationLevel =
    topHoldingPercent >= 40 || topThreePercent >= 80
      ? "high"
      : topHoldingPercent >= 25 || topThreePercent >= 60
        ? "medium"
        : "balanced";

  return {
    totalMarketValue,
    holdingCount: holdings.length,
    valuedHoldingCount: valuedHoldings.length,
    topHolding: topHolding
      ? {
          symbol: topHolding.symbol,
          marketValue: topHolding.marketValue,
          percent: topHoldingPercent,
        }
      : null,
    topHoldingPercent,
    topThreePercent,
    industryExposure,
    concentrationLevel,
  };
}
