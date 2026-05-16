import type { AlertCondition } from "@repo/database";

interface AlertRuleInput {
  conditionType: AlertCondition;
  threshold: number | null;
}

interface PriceInput {
  close: number;
  volume: number;
}

interface ScoreInput {
  compositeScore: number | null;
}

interface TradeInput {
  foreignNet: number;
  trustNet: number;
}

interface KeyLevelInput {
  supportPrice: number | null;
  resistPrice: number | null;
}

export interface AlertEvaluationInput {
  rule: AlertRuleInput;
  latestPrice: PriceInput;
  recentPrices: PriceInput[];
  recentScores: ScoreInput[];
  recentTrades: TradeInput[];
  keyLevels: KeyLevelInput | null;
  stockName: string;
  symbol: string;
}

export interface AlertEvaluationResult {
  triggered: boolean;
  message: string;
}

export function evaluateAlertRule(input: AlertEvaluationInput): AlertEvaluationResult {
  const { rule, latestPrice, stockName, symbol } = input;
  const close = latestPrice.close;
  const threshold = rule.threshold;
  const label = `${stockName}(${symbol})`;

  switch (rule.conditionType) {
    case "PRICE_ABOVE":
      if (threshold != null && close >= threshold) {
        return { triggered: true, message: `${label} 股價 ${close} 突破 ${threshold}` };
      }
      break;
    case "PRICE_BELOW":
      if (threshold != null && close <= threshold) {
        return { triggered: true, message: `${label} 股價 ${close} 跌破 ${threshold}` };
      }
      break;
    case "VOLUME_SPIKE": {
      if (input.recentPrices.length >= 6) {
        const previousFive = input.recentPrices.slice(1, 6);
        const avgVol =
          previousFive.reduce((sum, price) => sum + price.volume, 0) / previousFive.length;
        if (avgVol > 0 && latestPrice.volume > avgVol * 2) {
          return {
            triggered: true,
            message: `${label} 成交量異常放大，為均量 ${(latestPrice.volume / avgVol).toFixed(1)} 倍`,
          };
        }
      }
      break;
    }
    case "FOREIGN_NET_BUY":
    case "FOREIGN_NET_SELL":
    case "TRUST_NET_BUY": {
      const current = input.recentTrades[0];
      const previous = input.recentTrades[1];
      if (!current || !previous) break;

      if (rule.conditionType === "FOREIGN_NET_BUY" && current.foreignNet > 0 && previous.foreignNet <= 0) {
        return { triggered: true, message: `${label} 外資由賣轉買，今日淨買 ${current.foreignNet} 張` };
      }
      if (rule.conditionType === "FOREIGN_NET_SELL" && current.foreignNet < 0 && previous.foreignNet >= 0) {
        return { triggered: true, message: `${label} 外資由買轉賣，今日淨賣 ${Math.abs(current.foreignNet)} 張` };
      }
      if (rule.conditionType === "TRUST_NET_BUY" && current.trustNet > 0 && previous.trustNet <= 0) {
        return { triggered: true, message: `${label} 投信由賣轉買，今日淨買 ${current.trustNet} 張` };
      }
      break;
    }
    case "SCORE_UPGRADE":
    case "SCORE_DOWNGRADE": {
      const current = input.recentScores[0]?.compositeScore ?? null;
      const previous = input.recentScores[1]?.compositeScore ?? null;
      if (current == null || previous == null) break;
      const diff = current - previous;
      if (rule.conditionType === "SCORE_UPGRADE" && diff > 10) {
        return { triggered: true, message: `${label} 綜合評分升級 +${diff.toFixed(1)} 分` };
      }
      if (rule.conditionType === "SCORE_DOWNGRADE" && diff < -10) {
        return { triggered: true, message: `${label} 綜合評分降級 ${diff.toFixed(1)} 分` };
      }
      break;
    }
    case "BREAK_SUPPORT": {
      const support = input.keyLevels?.supportPrice ?? threshold;
      if (support != null && close <= support) {
        return { triggered: true, message: `${label} 股價 ${close} 跌破支撐 ${support}` };
      }
      break;
    }
    case "BREAK_RESISTANCE": {
      const resistance = input.keyLevels?.resistPrice ?? threshold;
      if (resistance != null && close >= resistance) {
        return { triggered: true, message: `${label} 股價 ${close} 突破壓力 ${resistance}` };
      }
      break;
    }
    default:
      break;
  }

  return { triggered: false, message: "" };
}
