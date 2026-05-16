"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";
import {
  formatPrice,
  formatChangePercent,
  formatVolume,
  getPriceClass,
} from "../lib/format";

export default function MarketPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<any>(null);
  const [dataHealth, setDataHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"volume" | "gainers" | "losers">("gainers");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [data, health] = await Promise.all([
        api.getMarketOverview(),
        api.getDataHealth(),
      ]);
      setOverview(data);
      setDataHealth(health);
    } catch (err) {
      console.error(err);
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

  if (!overview?.summary) {
    return (
      <div className="empty-state" style={{ height: "60vh" }}>
        <div className="icon">📊</div>
        <p>目前尚無市場資料</p>
      </div>
    );
  }

  const { summary, topVolume, topGainers, topLosers } = overview;
  const healthLabel: Record<string, string> = {
    ok: "資料可用",
    delayed: "資料延遲",
    failed: "同步失敗",
  };
  const healthColor: Record<string, string> = {
    ok: "var(--color-up)",
    delayed: "var(--score-caution)",
    failed: "var(--color-down)",
  };

  const tabList =
    activeTab === "volume"
      ? topVolume
      : activeTab === "gainers"
        ? topGainers
        : topLosers;

  return (
    <div className="fade-in">
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "var(--space-xs)" }}>
          📊 市場總覽
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          即時掌握大盤動態與市場氣氛
        </p>
      </div>

      {dataHealth && (
        <div className="card" style={{ marginBottom: "var(--space-xl)" }}>
          <div className="card-header">
            <span className="card-title">資料健康狀態</span>
            <span style={{ color: healthColor[dataHealth.status] || "var(--text-muted)", fontWeight: 700 }}>
              {healthLabel[dataHealth.status] || dataHealth.status}
            </span>
          </div>
          <div className="card-body">
            <div className="grid-4">
              <div>
                <div className="data-label">行情日</div>
                <div className="mono">{dataHealth.latestDates?.price ? new Date(dataHealth.latestDates.price).toLocaleDateString() : "-"}</div>
              </div>
              <div>
                <div className="data-label">分數日</div>
                <div className="mono">{dataHealth.latestDates?.score ? new Date(dataHealth.latestDates.score).toLocaleDateString() : "-"}</div>
              </div>
              <div>
                <div className="data-label">缺行情</div>
                <div className="mono">{dataHealth.coverage?.missingPriceCount ?? "-"}</div>
              </div>
              <div>
                <div className="data-label">缺分數</div>
                <div className="mono">{dataHealth.coverage?.missingScoreCount ?? "-"}</div>
              </div>
            </div>
            {dataHealth.jobs?.[0]?.errorMessage && (
              <div style={{ marginTop: 12, color: "var(--color-down)", fontSize: "0.82rem" }}>
                {dataHealth.jobs[0].jobType}: {dataHealth.jobs[0].errorMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 漲跌家數統計 */}
      <div className="grid-4" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="stat-card">
          <div className="data-label">上市股數</div>
          <div className="data-value lg">{summary.totalStocks.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="data-label">上漲家數</div>
          <div className="data-value lg" style={{ color: "var(--color-up)" }}>
            {summary.upCount}
          </div>
        </div>
        <div className="stat-card">
          <div className="data-label">下跌家數</div>
          <div className="data-value lg" style={{ color: "var(--color-down)" }}>
            {summary.downCount}
          </div>
        </div>
        <div className="stat-card">
          <div className="data-label">平盤</div>
          <div className="data-value lg" style={{ color: "var(--color-flat)" }}>
            {summary.flatCount}
          </div>
        </div>
      </div>

      {/* 漲跌比例條 */}
      <div className="card" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="card-body">
          <div
            style={{
              display: "flex",
              height: 28,
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
              gap: 2,
            }}
          >
            <div
              style={{
                flex: summary.upCount,
                background: "var(--color-up)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "white",
              }}
            >
              ↑ {summary.upCount}
            </div>
            <div
              style={{
                flex: summary.flatCount,
                background: "var(--color-flat)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "white",
              }}
            >
              {summary.flatCount}
            </div>
            <div
              style={{
                flex: summary.downCount,
                background: "var(--color-down)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "white",
              }}
            >
              ↓ {summary.downCount}
            </div>
          </div>
        </div>
      </div>

      {/* 排行榜 */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🏆 排行榜</span>
          <div className="category-tabs">
            <button
              className={`category-tab ${activeTab === "gainers" ? "active" : ""}`}
              onClick={() => setActiveTab("gainers")}
            >
              漲幅前 10
            </button>
            <button
              className={`category-tab ${activeTab === "losers" ? "active" : ""}`}
              onClick={() => setActiveTab("losers")}
            >
              跌幅前 10
            </button>
            <button
              className={`category-tab ${activeTab === "volume" ? "active" : ""}`}
              onClick={() => setActiveTab("volume")}
            >
              成交量前 10
            </button>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>股票</th>
              <th>產業</th>
              <th style={{ textAlign: "right" }}>收盤價</th>
              <th style={{ textAlign: "right" }}>漲跌幅</th>
              <th style={{ textAlign: "right" }}>成交量</th>
            </tr>
          </thead>
          <tbody>
            {tabList?.map((item: any, i: number) => (
              <tr
                key={item.symbol}
                style={{ cursor: "pointer" }}
                onClick={() => router.push(`/stocks/${item.symbol}`)}
              >
                <td style={{ fontFamily: "var(--font-mono)", color: i < 3 ? "var(--color-accent)" : "var(--text-muted)", fontWeight: i < 3 ? 700 : 400 }}>
                  {i + 1}
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--color-accent)", fontFamily: "var(--font-mono)" }}>
                    {item.symbol}
                  </div>
                </td>
                <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                  {item.industry || "-"}
                </td>
                <td className={`mono ${getPriceClass(item.change)}`} style={{ textAlign: "right" }}>
                  {formatPrice(item.close)}
                </td>
                <td className={`mono ${getPriceClass(item.change)}`} style={{ textAlign: "right", fontWeight: 600 }}>
                  {formatChangePercent(item.changePercent)}
                </td>
                <td className="mono" style={{ textAlign: "right", color: "var(--text-secondary)" }}>
                  {formatVolume(item.volume)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
