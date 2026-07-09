"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./lib/api";
import {
  formatPrice,
  formatChangePercent,
  getPriceClass,
  getCategoryLabel,
  getCategoryBadgeClass,
  getScoreColor,
} from "./lib/format";

const CATEGORIES = [
  { key: "", label: "全部" },
  { key: "CORE_WATCH", label: "🟢 核心觀察" },
  { key: "PARTIAL_ENTRY", label: "🔵 可分批布局" },
  { key: "SHORT_TERM", label: "🟡 短線觀察" },
  { key: "HIGH_RISK", label: "🔴 風險偏高" },
];

const SORT_OPTIONS = [
  { key: "composite", label: "綜合評分" },
  { key: "quality", label: "基本面" },
  { key: "timing", label: "技術面" },
  { key: "risk", label: "風險 (低→高)" },
];

export default function HomePage() {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("composite");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recData, sumData] = await Promise.all([
        api.getRecommendations({
          category: category || undefined,
          sort,
          limit: 50,
        }),
        api.getRecommendationsSummary(),
      ]);
      setRecommendations(recData.data || []);
      setSummary(sumData.categories || {});
    } catch (err) {
      console.error("Failed to load recommendations:", err);
    } finally {
      setLoading(false);
    }
  }, [category, sort]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="fade-in">
      {/* 頂部標題 */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "var(--space-xs)" }}>
          📈 今日優質股推薦
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          基於基本面、技術面、籌碼面三維度分析，每日盤後自動更新
        </p>
      </div>

      {/* 統計卡片 */}
      <div className="grid-4" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="stat-card">
          <div className="data-label">核心觀察</div>
          <div className="data-value lg" style={{ color: "var(--cat-core)" }}>
            {summary.CORE_WATCH || 0}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>高品質 + 低風險</div>
        </div>
        <div className="stat-card">
          <div className="data-label">可分批布局</div>
          <div className="data-value lg" style={{ color: "var(--cat-partial)" }}>
            {summary.PARTIAL_ENTRY || 0}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>中等評價</div>
        </div>
        <div className="stat-card">
          <div className="data-label">短線觀察</div>
          <div className="data-value lg" style={{ color: "var(--cat-short)" }}>
            {summary.SHORT_TERM || 0}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>需觀察</div>
        </div>
        <div className="stat-card">
          <div className="data-label">風險偏高</div>
          <div className="data-value lg" style={{ color: "var(--cat-risk)" }}>
            {summary.HIGH_RISK || 0}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>請留意</div>
        </div>
      </div>

      {/* 篩選與排序 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-lg)",
          flexWrap: "wrap",
          gap: "var(--space-sm)",
        }}
      >
        <div className="category-tabs">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              className={`category-tab ${category === c.key ? "active" : ""}`}
              onClick={() => setCategory(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "var(--space-xs)", alignItems: "center" }}>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>排序：</span>
          {SORT_OPTIONS.map((s) => (
            <button
              key={s.key}
              className={`btn btn-sm ${sort === s.key ? "btn-primary" : "btn-outline"}`}
              onClick={() => setSort(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 推薦列表 */}
      {loading ? (
        <div className="loading-spinner">
          <div className="spinner" />
        </div>
      ) : recommendations.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📭</div>
          <p>目前尚無推薦資料</p>
          <p style={{ fontSize: "0.78rem" }}>
            請先執行排程 Worker 同步資料後，系統將自動產生推薦清單
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {recommendations.map((rec: any, i: number) => (
            <div
              key={rec.symbol}
              className="rec-card"
              style={{ animationDelay: `${i * 30}ms` }}
              onClick={() => router.push(`/stocks/${rec.symbol}`)}
            >
              {/* 排名 */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: i < 3 ? "var(--color-accent-bg)" : "var(--bg-input)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: i < 3 ? "var(--color-accent)" : "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>

              {/* 股票資訊 */}
              <div className="stock-info">
                <div className="name">
                  {rec.name}
                  <span
                    style={{
                      marginLeft: 6,
                      fontFamily: "var(--font-mono)",
                      color: "var(--color-accent)",
                      fontSize: "0.82rem",
                    }}
                  >
                    {rec.symbol}
                  </span>
                </div>
                <div className="sub">
                  {rec.industry || "-"} ・{" "}
                  {rec.marketType === "TWSE" ? "上市" : "上櫃"}
                </div>
              </div>

              {/* 報價 */}
              <div className="price-info">
                <div className={`data-value ${getPriceClass(rec.change)}`}>
                  {formatPrice(rec.close)}
                </div>
                <div
                  className={getPriceClass(rec.change)}
                  style={{ fontSize: "0.78rem" }}
                >
                  {formatChangePercent(rec.changePercent)}
                </div>
              </div>

              {/* 分數 */}
              <div className="scores">
                <div className="mini-score">
                  <div className="value" style={{ color: getScoreColor(rec.compositeScore || 0) }}>
                    {Math.round(rec.compositeScore || 0)}
                  </div>
                  <div className="label">綜合</div>
                </div>
                <div className="mini-score">
                  <div className="value" style={{ color: getScoreColor(rec.qualityScore || 0) }}>
                    {Math.round(rec.qualityScore || 0)}
                  </div>
                  <div className="label">基本</div>
                </div>
                <div className="mini-score">
                  <div className="value" style={{ color: getScoreColor(rec.timingScore || 0) }}>
                    {Math.round(rec.timingScore || 0)}
                  </div>
                  <div className="label">技術</div>
                </div>
              </div>

              {/* 分類 Badge */}
              <span className={getCategoryBadgeClass(rec.category)}>
                {getCategoryLabel(rec.category)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
