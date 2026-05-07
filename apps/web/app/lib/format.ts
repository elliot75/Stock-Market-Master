/**
 * 格式化工具函式
 */

/** 格式化價格 (加千分位) */
export function formatPrice(price: number | null | undefined): string {
  if (price == null) return "-";
  return price.toLocaleString("zh-TW", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 格式化漲跌 */
export function formatChange(change: number | null | undefined): string {
  if (change == null) return "-";
  const prefix = change > 0 ? "▲" : change < 0 ? "▼" : "";
  return `${prefix} ${Math.abs(change).toFixed(2)}`;
}

/** 格式化漲跌幅 */
export function formatChangePercent(
  pct: number | null | undefined
): string {
  if (pct == null) return "-";
  const prefix = pct > 0 ? "+" : "";
  return `${prefix}${pct.toFixed(2)}%`;
}

/** 格式化成交量 (張) */
export function formatVolume(vol: number | null | undefined): string {
  if (vol == null) return "-";
  if (vol >= 100000000) return `${(vol / 100000000).toFixed(1)} 億`;
  if (vol >= 10000) return `${(vol / 10000).toFixed(0)} 萬`;
  return vol.toLocaleString();
}

/** 取得漲跌 CSS class */
export function getPriceClass(
  change: number | null | undefined
): string {
  if (change == null || change === 0) return "price-flat";
  return change > 0 ? "price-up" : "price-down";
}

/** 取得推薦分類顯示名稱 */
export function getCategoryLabel(
  category: string | null | undefined
): string {
  const map: Record<string, string> = {
    CORE_WATCH: "核心觀察",
    PARTIAL_ENTRY: "可分批布局",
    SHORT_TERM: "短線觀察",
    HIGH_RISK: "風險偏高",
  };
  return map[category || ""] || category || "-";
}

/** 取得推薦分類 badge CSS class */
export function getCategoryBadgeClass(
  category: string | null | undefined
): string {
  const map: Record<string, string> = {
    CORE_WATCH: "badge-core",
    PARTIAL_ENTRY: "badge-partial",
    SHORT_TERM: "badge-short",
    HIGH_RISK: "badge-risk",
  };
  return `badge ${map[category || ""] || ""}`;
}

/** 取得分數顏色 */
export function getScoreColor(score: number): string {
  if (score >= 75) return "var(--score-excellent)";
  if (score >= 60) return "var(--score-good)";
  if (score >= 45) return "var(--score-normal)";
  if (score >= 30) return "var(--score-caution)";
  return "var(--score-danger)";
}

/** 格式化日期 */
export function formatDate(date: string | Date | null): string {
  if (!date) return "-";
  const d = new Date(date);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
