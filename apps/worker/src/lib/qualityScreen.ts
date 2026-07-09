export type QualityScreenStatus = "pass" | "fail" | "warn" | "unknown";

export interface QualityScreenCheck {
  key: string;
  label: string;
  status: QualityScreenStatus;
  value: number | null;
  unit: string;
  message: string;
}

export interface QualityScreenResult {
  verdict: "pass" | "watch" | "fail";
  passCount: number;
  failCount: number;
  unknownCount: number;
  checks: QualityScreenCheck[];
  summary: string;
}

export interface QualityScreenFinancialInput {
  eps?: unknown;
  grossMargin?: unknown;
  netMargin?: unknown;
  roe?: unknown;
  debtRatio?: unknown;
}

function toFiniteNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function makeCheck(params: {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  pass?: (value: number) => boolean;
  warn?: (value: number) => boolean;
  passMessage: (value: number) => string;
  failMessage: (value: number) => string;
  warnMessage?: (value: number) => string;
  unknownMessage: string;
}): QualityScreenCheck {
  if (params.value == null) {
    return {
      key: params.key,
      label: params.label,
      status: "unknown",
      value: null,
      unit: params.unit,
      message: params.unknownMessage,
    };
  }

  if (params.pass?.(params.value)) {
    return {
      key: params.key,
      label: params.label,
      status: "pass",
      value: params.value,
      unit: params.unit,
      message: params.passMessage(params.value),
    };
  }

  if (params.warn?.(params.value)) {
    return {
      key: params.key,
      label: params.label,
      status: "warn",
      value: params.value,
      unit: params.unit,
      message: params.warnMessage?.(params.value) ?? params.failMessage(params.value),
    };
  }

  return {
    key: params.key,
    label: params.label,
    status: "fail",
    value: params.value,
    unit: params.unit,
    message: params.failMessage(params.value),
  };
}

export function evaluateAvailableQualityScreen(
  financial: QualityScreenFinancialInput | null
): QualityScreenResult {
  const eps = toFiniteNumber(financial?.eps);
  const grossMargin = toFiniteNumber(financial?.grossMargin);
  const netMargin = toFiniteNumber(financial?.netMargin);
  const roe = toFiniteNumber(financial?.roe);
  const debtRatio = toFiniteNumber(financial?.debtRatio);

  const checks: QualityScreenCheck[] = [
    makeCheck({
      key: "roe",
      label: "ROE",
      value: roe,
      unit: "%",
      pass: (value) => value >= 8,
      warn: (value) => value >= 5,
      passMessage: (value) => `ROE ${value.toFixed(1)}%，高於 8% 去劣線`,
      warnMessage: (value) => `ROE ${value.toFixed(1)}%，接近但未達 8% 去劣線`,
      failMessage: (value) => `ROE ${value.toFixed(1)}%，低於 8% 去劣線`,
      unknownMessage: "缺 ROE 資料，無法判斷資本效率",
    }),
    makeCheck({
      key: "grossMargin",
      label: "毛利率",
      value: grossMargin,
      unit: "%",
      pass: (value) => value >= 15,
      warn: (value) => value >= 10,
      passMessage: (value) => `毛利率 ${value.toFixed(1)}%，高於 15% 去劣線`,
      warnMessage: (value) => `毛利率 ${value.toFixed(1)}%，接近但未達 15% 去劣線`,
      failMessage: (value) => `毛利率 ${value.toFixed(1)}%，低於 15% 去劣線`,
      unknownMessage: "缺毛利率資料，無法判斷定價權",
    }),
    makeCheck({
      key: "netMargin",
      label: "淨利率",
      value: netMargin,
      unit: "%",
      pass: (value) => value >= 5,
      warn: (value) => value >= 0,
      passMessage: (value) => `淨利率 ${value.toFixed(1)}%，高於 5% 去劣線`,
      warnMessage: (value) => `淨利率 ${value.toFixed(1)}%，獲利偏薄但仍為正`,
      failMessage: (value) => `淨利率 ${value.toFixed(1)}%，低於 5% 去劣線`,
      unknownMessage: "缺淨利率資料，無法判斷抗風險能力",
    }),
    makeCheck({
      key: "debtRatio",
      label: "負債比",
      value: debtRatio,
      unit: "%",
      pass: (value) => value <= 60,
      warn: (value) => value <= 75,
      passMessage: (value) => `負債比 ${value.toFixed(1)}%，財務槓桿可控`,
      warnMessage: (value) => `負債比 ${value.toFixed(1)}%，槓桿偏高需追蹤`,
      failMessage: (value) => `負債比 ${value.toFixed(1)}%，財務槓桿偏高`,
      unknownMessage: "缺負債比資料，無法判斷財務槓桿",
    }),
    makeCheck({
      key: "eps",
      label: "EPS",
      value: eps,
      unit: "元",
      pass: (value) => value > 0,
      failMessage: (value) => `EPS ${value.toFixed(2)}，最近一季未獲利`,
      passMessage: (value) => `EPS ${value.toFixed(2)}，最近一季維持獲利`,
      unknownMessage: "缺 EPS 資料，無法判斷近期獲利",
    }),
    {
      key: "freeCashFlow",
      label: "自由現金流",
      status: "unknown",
      value: null,
      unit: "",
      message: "目前資料庫缺 FCF 欄位，先標示資料不足",
    },
    {
      key: "shareDilution",
      label: "股本稀釋",
      status: "unknown",
      value: null,
      unit: "",
      message: "目前資料庫缺 5 年股本變化，先標示資料不足",
    },
  ];

  const passCount = checks.filter((check) => check.status === "pass").length;
  const failCount = checks.filter((check) => check.status === "fail").length;
  const unknownCount = checks.filter((check) => check.status === "unknown").length;
  const verdict = failCount > 0 ? "fail" : passCount >= 4 ? "pass" : "watch";

  return {
    verdict,
    passCount,
    failCount,
    unknownCount,
    checks,
    summary:
      verdict === "pass"
        ? `可得資料去劣通過：${passCount} 項通過，${unknownCount} 項資料不足`
        : verdict === "fail"
          ? `可得資料去劣未通過：${failCount} 項觸發紅線，${unknownCount} 項資料不足`
          : `可得資料需觀察：${passCount} 項通過，${unknownCount} 項資料不足`,
  };
}
