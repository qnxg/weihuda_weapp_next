export type RankScoreType = "score" | "gpa";

export interface ParsedRankPosition {
  position: number;
  total: number;
  percentage: string;
}

const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:\.(\d+))?$/;
const RANK_PATTERN = /^(\d+)\s*\/\s*(\d+)$/;
const rankPercentageFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 1,
});

export function formatRankScore(value: string | null, valueType: RankScoreType) {
  if (value === null) return "";
  const normalized = value.trim();
  const match = normalized.match(DECIMAL_PATTERN);
  if (!match) return value;

  const [, sign, integerDigits, decimalDigits = ""] = match;
  const integerValue = BigInt(integerDigits);
  const isExactHundred = sign !== "-" && integerValue === 100n && !/[1-9]/.test(decimalDigits);
  if (valueType === "score" && isExactHundred) return "100";

  const precision = valueType === "gpa" ? 1 : 2;
  const scale = 10n ** BigInt(precision);
  const retainedDigits = decimalDigits.padEnd(precision, "0").slice(0, precision);
  let scaledValue = integerValue * scale + BigInt(retainedDigits || "0");
  if (Number(decimalDigits[precision] ?? "0") >= 5) scaledValue += 1n;

  const whole = scaledValue / scale;
  const fraction = String(scaledValue % scale).padStart(precision, "0");
  const prefix = sign === "-" && scaledValue !== 0n ? "-" : "";
  return `${prefix}${whole}.${fraction}`;
}

export function parseRankPosition(value: string | null): ParsedRankPosition | null {
  if (value === null) return null;
  const match = value.trim().match(RANK_PATTERN);
  if (!match) return null;

  const position = Number(match[1]);
  const total = Number(match[2]);
  if (
    !Number.isSafeInteger(position) ||
    !Number.isSafeInteger(total) ||
    position < 1 ||
    total < position
  ) {
    return null;
  }

  return {
    position,
    total,
    percentage: rankPercentageFormatter.format((position / total) * 100),
  };
}
