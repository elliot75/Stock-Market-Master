"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { useRealtimeQuotes } from "../../hooks/useRealtimeQuotes";
import {
  formatPrice,
  formatChange,
  formatChangePercent,
  formatVolume,
  getPriceClass,
  getCategoryLabel,
  getCategoryBadgeClass,
  getScoreColor,
  formatDate,
} from "../../lib/format";
import KLineChart from "../../components/KLineChart";
import ScoreGauge from "../../components/ScoreGauge";

export default function StockPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = use(params);
  const router = useRouter();
  const [overview, setOverview] = useState<any>(null);
  const [chart, setChart] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userToken, setUserToken] = useState("");
  const [watchlists, setWatchlists] = useState<any[]>([]);
  const [addingTo, setAddingTo] = useState("");
  
  const { quotes, prevQuotes } = useRealtimeQuotes(symbol ? [symbol] : [], 15000);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) {
      setUserToken(t);
      api.getWatchlists(t).then(setWatchlists).catch(console.error);
    }
    loadData();
  }, [symbol]);

  async function handleAddWatchlist(watchlistId: string) {
    if (!userToken) return alert("請先登入");
    setAddingTo(watchlistId);
    try {
      await api.addToWatchlist(watchlistId, symbol, userToken);
      alert("已加入自選股！");
    } catch (err: any) {
      alert(err.message || "加入失敗");
    } finally {
      setAddingTo("");
    }
  }

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [ov, ch, an] = await Promise.all([
        api.getStockOverview(symbol),
        api.getStockChart(symbol, 120),
        api.getStockAnalysis(symbol),
      ]);
      setOverview(ov);
      setChart(ch);
      setAnalysis(an);
    } catch (err: any) {
      setError(err.message || "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-spinner" style={{ height: "60vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state" style={{ height: "60vh" }}>
        <div className="icon">⚠️</div>
        <p>{error}</p>
      </div>
    );
  }

  const stock = overview?.stock;
  const price = overview?.price;
  const score = overview?.score;
  const tech = analysis?.technical;
  const chips = analysis?.chips;
  const vol = analysis?.volume;
  const keyLevels = analysis?.keyLevels;
  const scenarios = analysis?.scenarios || [];
  const fundamentals = analysis?.fundamentals;

  const rtQuote = quotes[symbol];
  const prevRtQuote = prevQuotes[symbol];
  
  const displayPrice = rtQuote ? rtQuote.price : price?.close;
  const displayChange = rtQuote ? rtQuote.change : price?.change;
  const displayChangePercent = rtQuote ? rtQuote.changePercent : price?.changePercent;

  const priceClass = getPriceClass(displayChange);
  
  let flashClass = "";
  if (rtQuote && prevRtQuote && rtQuote.price !== prevRtQuote.price) {
    flashClass = rtQuote.price > prevRtQuote.price ? "flash-up" : "flash-down";
  }

  return (
    <div className="fade-in">
      {/* ─── Stock Header Bar ─── */}
      <div className="stock-header" style={{ marginBottom: "var(--space-md)" }}>
        <button 
          onClick={() => router.back()} 
          className="btn btn-ghost btn-sm" 
          style={{ padding: "4px 8px", fontSize: "1.1rem", marginRight: "-8px" }}
          title="返回前一頁"
        >
          ←
        </button>
        <div className="stock-title">
          <span className="stock-name">{stock?.name || symbol}</span>
          <span className="stock-symbol">{symbol}</span>
          {stock?.industry && (
            <span className="stock-industry">{stock.industry}</span>
          )}
          <div style={{ marginLeft: "auto", position: "relative" }} className="dropdown-container">
            <button className="btn btn-outline btn-sm" onClick={(e) => {
              if (!userToken) {
                alert("請先登入");
                return;
              }
              const el = e.currentTarget.nextElementSibling as HTMLElement;
              el.style.display = el.style.display === "block" ? "none" : "block";
            }}>
              ⭐ 加入自選股
            </button>
            <div 
              className="dropdown-menu" 
              style={{ 
                display: "none", 
                position: "absolute", 
                top: "100%", 
                right: 0, 
                marginTop: 4, 
                background: "var(--bg-card)", 
                border: "1px solid var(--border-primary)", 
                borderRadius: "var(--radius-md)", 
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)", 
                zIndex: 100,
                minWidth: 150,
                padding: "8px 0"
              }}
            >
              {watchlists.length === 0 ? (
                <div style={{ padding: "8px 16px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  沒有自選清單，請至自選股頁面建立
                </div>
              ) : (
                watchlists.map(w => (
                  <div
                    key={w.id}
                    style={{ padding: "8px 16px", cursor: "pointer", fontSize: "0.85rem" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--bg-card-hover)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    onClick={(e) => {
                      (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                      handleAddWatchlist(w.id);
                    }}
                  >
                    {addingTo === w.id ? "⏳ 加入中..." : w.name}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {displayPrice !== undefined && (
          <div className="stock-price-section">
            <span className={`stock-current-price ${priceClass} ${flashClass}`}>
              {formatPrice(displayPrice)}
            </span>
            <span className={`stock-change ${priceClass} ${flashClass}`}>
              {formatChange(displayChange)}{" "}
              ({formatChangePercent(displayChangePercent)})
            </span>
          </div>
        )}

        <div className="stock-meta">
          {price && (
            <>
              <div className="stock-meta-item">
                <div className="data-label">成交量</div>
                <div className="data-value mono">{formatVolume(price.volume)}</div>
              </div>
              <div className="stock-meta-item">
                <div className="data-label">成交額</div>
                <div className="data-value mono">{formatVolume(price.turnover)}</div>
              </div>
            </>
          )}
          <div className="stock-meta-item">
            <div className="data-label">更新時間</div>
            <div className="data-value" style={{ fontSize: "0.82rem" }}>
              {formatDate(price?.date)}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Dashboard Grid ─── */}
      <div className="dashboard-grid">
        {/* ─── Left: K 線圖 ─── */}
        <div className="dashboard-chart">
          <div className="card" style={{ height: "100%" }}>
            <div className="card-header">
              <span className="card-title">
                📊 技術面分析 (日K線)
              </span>
              <div style={{ display: "flex", gap: "var(--space-sm)", fontSize: "0.72rem" }}>
                <span style={{ color: "#f59e0b" }}>━ MA5</span>
                <span style={{ color: "#3b82f6" }}>━ MA20</span>
                <span style={{ color: "#a855f7" }}>━ MA60</span>
              </div>
            </div>
            <div style={{ padding: "var(--space-sm)" }}>
              <KLineChart data={chart?.candles || []} height={380} />
            </div>

            {/* MA 數值 */}
            {tech && (
              <div
                style={{
                  padding: "var(--space-sm) var(--space-lg)",
                  display: "flex",
                  gap: "var(--space-lg)",
                  borderTop: "1px solid var(--border-primary)",
                  fontSize: "0.78rem",
                  fontFamily: "var(--font-mono)",
                }}
              >
                <span>
                  <span style={{ color: "#f59e0b" }}>MA5</span>{" "}
                  {tech.ma5?.toFixed(2) || "-"}
                </span>
                <span>
                  <span style={{ color: "#3b82f6" }}>MA20</span>{" "}
                  {tech.ma20?.toFixed(2) || "-"}
                </span>
                <span>
                  <span style={{ color: "#a855f7" }}>MA60</span>{" "}
                  {tech.ma60?.toFixed(2) || "-"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ─── Right: Analysis Panels ─── */}
        <div className="dashboard-panels">
          {/* 技術分析總覽 */}
          {tech && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">📋 技術分析總覽</span>
              </div>
              <div className="card-body" style={{ padding: "var(--space-sm) var(--space-md)" }}>
                <table className="data-table">
                  <tbody>
                    <tr>
                      <td style={{ color: "var(--text-muted)" }}>趨勢方向</td>
                      <td style={{ fontWeight: 600, color: tech.trendDirection?.includes("多") ? "var(--color-up)" : tech.trendDirection?.includes("空") ? "var(--color-down)" : "var(--text-primary)" }}>
                        {tech.trendDirection || "-"}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: "var(--text-muted)" }}>MA 狀態</td>
                      <td>{tech.maStatus || "-"}</td>
                    </tr>
                    <tr>
                      <td style={{ color: "var(--text-muted)" }}>KD 指標</td>
                      <td className="mono">
                        K({tech.kd?.k?.toFixed(1)}) D({tech.kd?.d?.toFixed(1)})
                        <span style={{ marginLeft: 8, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {tech.kdSignal}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: "var(--text-muted)" }}>MACD</td>
                      <td className="mono">
                        DIF {tech.macd?.dif?.toFixed(2) || "-"}
                        <span style={{ marginLeft: 8, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {tech.macdSignal}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: "var(--text-muted)" }}>RSI(14)</td>
                      <td className="mono" style={{
                        color: (tech.rsi14 || 50) > 70 ? "var(--color-up)" : (tech.rsi14 || 50) < 30 ? "var(--color-down)" : "var(--text-primary)"
                      }}>
                        {tech.rsi14?.toFixed(1) || "-"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 評分儀表板 */}
          {score && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">🎯 綜合評分</span>
                <span className={getCategoryBadgeClass(score.category)}>
                  {getCategoryLabel(score.category)}
                </span>
              </div>
              <div className="card-body">
                <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
                  <ScoreGauge value={score.compositeScore} label="綜合" size={85} />
                  <ScoreGauge value={score.qualityScore} label="基本面" size={70} />
                  <ScoreGauge value={score.timingScore} label="技術面" size={70} />
                  <ScoreGauge value={100 - score.riskScore} label="安全度" size={70} />
                </div>

                {/* 分析原因 */}
                {score.analysisJson?.reasons && (
                  <div
                    style={{
                      marginTop: "var(--space-md)",
                      padding: "var(--space-sm) var(--space-md)",
                      background: "var(--bg-input)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.78rem",
                    }}
                  >
                    {(score.analysisJson.reasons as string[]).map(
                      (reason: string, i: number) => (
                        <div key={i} style={{ padding: "2px 0", color: "var(--text-secondary)" }}>
                          • {reason}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 籌碼分析 */}
          {chips && chips.daily.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">💰 籌碼分析 (近{chips.recentDays}日)</span>
              </div>
              <div className="card-body" style={{ padding: "var(--space-sm) var(--space-md)" }}>
                {/* 法人合計 */}
                <div className="grid-3" style={{ marginBottom: "var(--space-md)", textAlign: "center" }}>
                  <div>
                    <div className="data-label">外資合計</div>
                    <div
                      className="data-value mono"
                      style={{ color: chips.summary.foreignTotal > 0 ? "var(--color-up)" : "var(--color-down)", fontSize: "0.95rem" }}
                    >
                      {chips.summary.foreignTotal > 0 ? "+" : ""}
                      {chips.summary.foreignTotal.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="data-label">投信合計</div>
                    <div
                      className="data-value mono"
                      style={{ color: chips.summary.trustTotal > 0 ? "var(--color-up)" : "var(--color-down)", fontSize: "0.95rem" }}
                    >
                      {chips.summary.trustTotal > 0 ? "+" : ""}
                      {chips.summary.trustTotal.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="data-label">自營商合計</div>
                    <div
                      className="data-value mono"
                      style={{ color: chips.summary.dealerTotal > 0 ? "var(--color-up)" : "var(--color-down)", fontSize: "0.95rem" }}
                    >
                      {chips.summary.dealerTotal > 0 ? "+" : ""}
                      {chips.summary.dealerTotal.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* 每日明細 (最近5日) */}
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th style={{ textAlign: "right" }}>外資</th>
                      <th style={{ textAlign: "right" }}>投信</th>
                      <th style={{ textAlign: "right" }}>合計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chips.daily.slice(0, 5).map((d: any) => (
                      <tr key={d.date}>
                        <td>{formatDate(d.date)}</td>
                        <td
                          className="mono"
                          style={{ textAlign: "right", color: d.foreignNet > 0 ? "var(--color-up)" : "var(--color-down)" }}
                        >
                          {d.foreignNet > 0 ? "+" : ""}{d.foreignNet.toLocaleString()}
                        </td>
                        <td
                          className="mono"
                          style={{ textAlign: "right", color: d.trustNet > 0 ? "var(--color-up)" : "var(--color-down)" }}
                        >
                          {d.trustNet > 0 ? "+" : ""}{d.trustNet.toLocaleString()}
                        </td>
                        <td
                          className="mono"
                          style={{ textAlign: "right", fontWeight: 600, color: d.totalNet > 0 ? "var(--color-up)" : "var(--color-down)" }}
                        >
                          {d.totalNet > 0 ? "+" : ""}{d.totalNet.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 量能分析 */}
          {vol && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">📊 量能分析</span>
              </div>
              <div className="card-body">
                <div className="grid-2" style={{ textAlign: "center" }}>
                  <div>
                    <div className="data-label">今日成交量</div>
                    <div className="data-value mono">{formatVolume(vol.todayVolume)}</div>
                  </div>
                  <div>
                    <div className="data-label">5日均量</div>
                    <div className="data-value mono">{formatVolume(vol.avgVolume5)}</div>
                  </div>
                  <div>
                    <div className="data-label">量能變化</div>
                    <div className="data-value mono">{vol.volumeChange || "-"}</div>
                  </div>
                  <div>
                    <div className="data-label">量價關係</div>
                    <div className="data-value" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                      {vol.priceVolumeRelation || "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 基本面摘要 */}
          {fundamentals?.financial && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">🏢 基本面摘要</span>
              </div>
              <div className="card-body">
                <div className="grid-3" style={{ textAlign: "center" }}>
                  <div>
                    <div className="data-label">EPS</div>
                    <div className="data-value mono">
                      {fundamentals.financial.eps?.toFixed(2) || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="data-label">毛利率</div>
                    <div className="data-value mono">
                      {fundamentals.financial.grossMargin
                        ? `${fundamentals.financial.grossMargin.toFixed(1)}%`
                        : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="data-label">ROE</div>
                    <div className="data-value mono">
                      {fundamentals.financial.roe
                        ? `${fundamentals.financial.roe.toFixed(1)}%`
                        : "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Bottom: 關鍵價位 + 操作劇本 + 結論 ─── */}
        <div className="dashboard-footer">
          {/* 關鍵價位 */}
          {keyLevels && keyLevels.resistance1 && (
            <div className="card" style={{ marginBottom: "var(--space-md)" }}>
              <div className="card-header">
                <span className="card-title">🎯 關鍵價位</span>
              </div>
              <div className="card-body">
                <div className="grid-4" style={{ textAlign: "center" }}>
                  <div>
                    <div className="data-label">壓力區</div>
                    <div className="data-value mono" style={{ color: "var(--color-up)" }}>
                      {keyLevels.resistance1?.toLocaleString()} ~ {keyLevels.resistance2?.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="data-label">支撐區</div>
                    <div className="data-value mono" style={{ color: "var(--color-down)" }}>
                      {keyLevels.support1?.toLocaleString()} ~ {keyLevels.support2?.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="data-label">停損參考</div>
                    <div className="data-value mono" style={{ color: "var(--color-warning)" }}>
                      {keyLevels.stopLoss?.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="data-label">當前價位</div>
                    <div className="data-value mono">
                      {price ? formatPrice(price.close) : "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 操作劇本 */}
          {scenarios.length > 0 && (
            <div style={{ display: "flex", gap: "var(--space-md)", marginBottom: "var(--space-md)" }}>
              {scenarios.map((s: any, i: number) => (
                <div
                  key={i}
                  className={`scenario-card ${i === 0 ? "up" : i === 1 ? "neutral" : "down"}`}
                >
                  <div
                    className="scenario-title"
                    style={{
                      color: i === 0 ? "var(--color-up)" : i === 1 ? "var(--color-warning)" : "var(--color-down)",
                    }}
                  >
                    {s.name}
                  </div>
                  <div className="scenario-row">
                    <span className="scenario-label">條件</span>
                    <span className="mono" style={{ fontSize: "0.78rem" }}>{s.condition}</span>
                  </div>
                  <div className="scenario-row">
                    <span className="scenario-label">進場</span>
                    <span className="mono" style={{ fontSize: "0.78rem" }}>{s.entry}</span>
                  </div>
                  <div className="scenario-row">
                    <span className="scenario-label">停損</span>
                    <span className="mono" style={{ fontSize: "0.78rem", color: "var(--color-warning)" }}>{s.stopLoss}</span>
                  </div>
                  <div className="scenario-row">
                    <span className="scenario-label">目標</span>
                    <span className="mono" style={{ fontSize: "0.78rem" }}>{s.target}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 整體結論 */}
          {score && (
            <div className="conclusion-bar">
              <span className="icon">⭐</span>
              <div>
                <span
                  className="text"
                  style={{
                    color:
                      score.category === "CORE_WATCH"
                        ? "var(--cat-core)"
                        : score.category === "PARTIAL_ENTRY"
                          ? "var(--cat-partial)"
                          : score.category === "SHORT_TERM"
                            ? "var(--cat-short)"
                            : "var(--cat-risk)",
                  }}
                >
                  整體評估：{getCategoryLabel(score.category)}
                </span>
                <span style={{ margin: "0 var(--space-sm)", color: "var(--text-muted)" }}>|</span>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  綜合 {Math.round(score.compositeScore)} 分 ・ 基本面 {Math.round(score.qualityScore)} ・ 技術面{" "}
                  {Math.round(score.timingScore)} ・ 風險 {Math.round(score.riskScore)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
