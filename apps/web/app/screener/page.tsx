"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";
import {
  formatPrice,
  formatChangePercent,
  formatVolume,
  getPriceClass,
  getCategoryLabel,
  getCategoryBadgeClass,
  getScoreColor,
} from "../lib/format";

const PRESET_FILTERS = [
  {
    label: "🏆 高品質核心股",
    filters: { compositeScoreMin: 70, riskScoreMax: 40, category: "CORE_WATCH" },
  },
  {
    label: "📈 技術面多頭",
    filters: { maCondition: "bullish", timingScoreMin: 60 },
  },
  {
    label: "💰 外資連買",
    filters: { foreignNetDays: 3, foreignNetDirection: "buy" },
  },
  {
    label: "⚡ 高分低風險",
    filters: { compositeScoreMin: 60, riskScoreMax: 35 },
  },
];

export default function ScreenerPage() {
  const router = useRouter();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<any>(null);

  // 自訂篩選條件
  const [compositeMin, setCompositeMin] = useState("");
  const [qualityMin, setQualityMin] = useState("");
  const [timingMin, setTimingMin] = useState("");
  const [riskMax, setRiskMax] = useState("");
  const [maCondition, setMaCondition] = useState("any");
  const [marketType, setMarketType] = useState("");
  const [industry, setIndustry] = useState("");

  async function runSearch(filters?: Record<string, unknown>) {
    setLoading(true);
    try {
      const f = filters || buildFilters();
      const data = await api.runScreener(f);
      setResults(data.data || []);
      setMeta(data.meta);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function buildFilters() {
    const f: Record<string, unknown> = {};
    if (compositeMin) f.compositeScoreMin = parseFloat(compositeMin);
    if (qualityMin) f.qualityScoreMin = parseFloat(qualityMin);
    if (timingMin) f.timingScoreMin = parseFloat(timingMin);
    if (riskMax) f.riskScoreMax = parseFloat(riskMax);
    if (maCondition !== "any") f.maCondition = maCondition;
    if (marketType) f.marketType = marketType;
    if (industry) f.industry = industry;
    return f;
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "var(--space-xs)" }}>
          🔍 條件選股
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          依據技術面、基本面、分數條件篩選潛力股
        </p>
      </div>

      {/* 快速預設 */}
      <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-lg)", flexWrap: "wrap" }}>
        {PRESET_FILTERS.map((p) => (
          <button
            key={p.label}
            className="btn btn-outline"
            onClick={() => runSearch(p.filters)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 自訂條件 */}
      <div className="card" style={{ marginBottom: "var(--space-lg)" }}>
        <div className="card-header">
          <span className="card-title">⚙️ 自訂條件</span>
        </div>
        <div className="card-body">
          <div className="grid-4" style={{ gap: "var(--space-md)" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">綜合分 ≥</label>
              <input
                className="form-input"
                type="number"
                placeholder="0~100"
                value={compositeMin}
                onChange={(e) => setCompositeMin(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">基本面分 ≥</label>
              <input
                className="form-input"
                type="number"
                placeholder="0~100"
                value={qualityMin}
                onChange={(e) => setQualityMin(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">技術面分 ≥</label>
              <input
                className="form-input"
                type="number"
                placeholder="0~100"
                value={timingMin}
                onChange={(e) => setTimingMin(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">風險分 ≤</label>
              <input
                className="form-input"
                type="number"
                placeholder="0~100"
                value={riskMax}
                onChange={(e) => setRiskMax(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">均線排列</label>
              <select
                className="form-input"
                value={maCondition}
                onChange={(e) => setMaCondition(e.target.value)}
              >
                <option value="any">不限</option>
                <option value="bullish">多頭排列</option>
                <option value="bearish">空頭排列</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">市場</label>
              <select
                className="form-input"
                value={marketType}
                onChange={(e) => setMarketType(e.target.value)}
              >
                <option value="">全部</option>
                <option value="TWSE">上市</option>
                <option value="TPEX">上櫃</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">產業 (關鍵字)</label>
              <input
                className="form-input"
                placeholder="如：半導體"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0, display: "flex", alignItems: "flex-end" }}>
              <button className="btn btn-primary" onClick={() => runSearch()} style={{ width: "100%" }}>
                開始搜尋
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 結果 */}
      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : results.length > 0 ? (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              搜尋結果 ({meta?.total || results.length} 檔)
            </span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>股票</th>
                <th>產業</th>
                <th style={{ textAlign: "right" }}>收盤價</th>
                <th style={{ textAlign: "right" }}>漲跌幅</th>
                <th style={{ textAlign: "center" }}>綜合分</th>
                <th style={{ textAlign: "center" }}>基本面</th>
                <th style={{ textAlign: "center" }}>技術面</th>
                <th style={{ textAlign: "center" }}>風險</th>
                <th style={{ textAlign: "center" }}>分類</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r: any, i: number) => (
                <tr
                  key={r.symbol}
                  style={{ cursor: "pointer" }}
                  onClick={() => router.push(`/stocks/${r.symbol}`)}
                >
                  <td className="mono" style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--color-accent)", fontFamily: "var(--font-mono)" }}>
                      {r.symbol}
                    </div>
                  </td>
                  <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                    {r.industry || "-"}
                  </td>
                  <td className={`mono ${getPriceClass(r.change)}`} style={{ textAlign: "right" }}>
                    {formatPrice(r.close)}
                  </td>
                  <td className={`mono ${getPriceClass(r.change)}`} style={{ textAlign: "right" }}>
                    {formatChangePercent(r.changePercent)}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span className="mono" style={{ fontWeight: 700, color: getScoreColor(r.compositeScore) }}>
                      {Math.round(r.compositeScore)}
                    </span>
                  </td>
                  <td className="mono" style={{ textAlign: "center", color: getScoreColor(r.qualityScore) }}>
                    {Math.round(r.qualityScore)}
                  </td>
                  <td className="mono" style={{ textAlign: "center", color: getScoreColor(r.timingScore) }}>
                    {Math.round(r.timingScore)}
                  </td>
                  <td className="mono" style={{ textAlign: "center", color: getScoreColor(100 - r.riskScore) }}>
                    {Math.round(r.riskScore)}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span className={getCategoryBadgeClass(r.category)}>
                      {getCategoryLabel(r.category)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : meta ? (
        <div className="empty-state">
          <div className="icon">🔍</div>
          <p>沒有符合條件的股票</p>
        </div>
      ) : null}
    </div>
  );
}
