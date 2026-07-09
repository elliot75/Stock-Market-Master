export type DecimalInput = string | number | bigint;

interface ExactDecimal {
  units: bigint;
  scale: number;
}

export interface MarketCapResult {
  marketCap: number;
  marketCapHundredMillion: number;
}

export interface MarketCapVerification extends MarketCapResult {
  reportedMarketCap: number;
  deviationPercent: number;
  status: "pass" | "warn" | "fail";
}

export interface ValuationResult {
  pe: number | null;
  pb: number | null;
  fcfYieldPercent: number | null;
  dividendYieldPercent: number | null;
}

function expandScientificNotation(value: string): string {
  const match = value
    .trim()
    .match(/^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (!match) return value;

  const [, sign = "", intPart, fracPart = "", exponentRaw] = match;
  if (!intPart || !exponentRaw) return value;
  const exponent = Number(exponentRaw);
  const digits = `${intPart}${fracPart}`;
  const decimalIndex = intPart.length + exponent;

  if (decimalIndex <= 0) {
    return `${sign}0.${"0".repeat(Math.abs(decimalIndex))}${digits}`;
  }
  if (decimalIndex >= digits.length) {
    return `${sign}${digits}${"0".repeat(decimalIndex - digits.length)}`;
  }
  return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
}

function parseExactDecimal(value: DecimalInput): ExactDecimal {
  if (typeof value === "bigint") return { units: value, scale: 0 };
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error(`Invalid decimal value: ${value}`);
  }

  const normalized = expandScientificNotation(String(value).replace(/,/g, "").trim());
  const match = normalized.match(/^([+-]?)(\d*)(?:\.(\d*))?$/);
  if (!match) throw new Error(`Invalid decimal value: ${value}`);

  const [, signRaw = "", intRaw = "", fracRaw = ""] = match;
  const intPart = intRaw || "0";
  const fracPart = fracRaw;
  const digits = `${intPart}${fracPart}`.replace(/^0+(?=\d)/, "") || "0";
  const sign = signRaw === "-" ? -1n : 1n;

  return {
    units: BigInt(digits) * sign,
    scale: fracPart.length,
  };
}

function pow10(exp: number): bigint {
  return 10n ** BigInt(exp);
}

function multiplyExact(a: ExactDecimal, b: ExactDecimal): ExactDecimal {
  return {
    units: a.units * b.units,
    scale: a.scale + b.scale,
  };
}

function toNumber(value: ExactDecimal): number {
  return Number(value.units) / 10 ** value.scale;
}

function absBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function percentDeviation(a: ExactDecimal, b: ExactDecimal): number {
  const scale = Math.max(a.scale, b.scale);
  const aUnits = a.units * pow10(scale - a.scale);
  const bUnits = b.units * pow10(scale - b.scale);
  if (bUnits === 0n) return aUnits === 0n ? 0 : Number.POSITIVE_INFINITY;

  const diff = absBigInt(aUnits - bUnits);
  const scaledPercent = (diff * 1_000_000n) / absBigInt(bUnits);
  return Number(scaledPercent) / 10_000;
}

function divideToNumber(
  numerator: ExactDecimal,
  denominator: ExactDecimal,
  resultScale = 6
): number | null {
  if (denominator.units === 0n) return null;

  let n = numerator.units;
  let d = denominator.units;
  const exponent = denominator.scale + resultScale - numerator.scale;
  if (exponent >= 0) n *= pow10(exponent);
  else d *= pow10(Math.abs(exponent));

  return Number(n / d) / 10 ** resultScale;
}

function roundTo(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function deriveTaiwanSharesFromCapitalThousand(
  capitalThousand: DecimalInput,
  parValue = 10
): bigint {
  if (parValue <= 0) throw new Error("parValue must be positive");
  const capital = parseExactDecimal(capitalThousand);
  if (capital.scale !== 0) {
    throw new Error("capitalThousand must be an integer amount");
  }
  return (capital.units * 1000n) / BigInt(parValue);
}

export function calculateMarketCap(params: {
  price: DecimalInput;
  shares: DecimalInput;
}): MarketCapResult {
  const marketCap = multiplyExact(
    parseExactDecimal(params.price),
    parseExactDecimal(params.shares)
  );
  const value = toNumber(marketCap);
  return {
    marketCap: value,
    marketCapHundredMillion: value / 100_000_000,
  };
}

export function verifyMarketCap(params: {
  price: DecimalInput;
  shares: DecimalInput;
  reportedMarketCap: DecimalInput;
  warningTolerancePercent?: number;
  failureTolerancePercent?: number;
}): MarketCapVerification {
  const calculated = multiplyExact(
    parseExactDecimal(params.price),
    parseExactDecimal(params.shares)
  );
  const reported = parseExactDecimal(params.reportedMarketCap);
  const deviationPercent = percentDeviation(calculated, reported);
  const warningTolerance = params.warningTolerancePercent ?? 1;
  const failureTolerance = params.failureTolerancePercent ?? 5;
  const status =
    deviationPercent > failureTolerance
      ? "fail"
      : deviationPercent > warningTolerance
        ? "warn"
        : "pass";
  const marketCap = toNumber(calculated);

  return {
    marketCap,
    marketCapHundredMillion: marketCap / 100_000_000,
    reportedMarketCap: toNumber(reported),
    deviationPercent,
    status,
  };
}

export function calculateValuation(params: {
  price: DecimalInput;
  eps?: DecimalInput | null;
  bookValuePerShare?: DecimalInput | null;
  fcfPerShare?: DecimalInput | null;
  dividend?: DecimalInput | null;
}): ValuationResult {
  const price = parseExactDecimal(params.price);
  const eps = params.eps == null ? null : parseExactDecimal(params.eps);
  const bookValue =
    params.bookValuePerShare == null
      ? null
      : parseExactDecimal(params.bookValuePerShare);
  const fcf =
    params.fcfPerShare == null ? null : parseExactDecimal(params.fcfPerShare);
  const dividend =
    params.dividend == null ? null : parseExactDecimal(params.dividend);

  return {
    pe: eps && eps.units > 0n ? divideToNumber(price, eps, 4) : null,
    pb: bookValue && bookValue.units > 0n ? divideToNumber(price, bookValue, 4) : null,
    fcfYieldPercent:
      fcf && price.units > 0n
        ? roundTo((divideToNumber(fcf, price, 6) ?? 0) * 100)
        : null,
    dividendYieldPercent:
      dividend && price.units > 0n
        ? roundTo((divideToNumber(dividend, price, 6) ?? 0) * 100)
        : null,
  };
}
