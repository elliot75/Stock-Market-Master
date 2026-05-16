"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatPrice, formatChangePercent, getCategoryLabel, getPriceClass } from "../lib/format";

export default function BacktestPage() {
  const [category, setCategory] = useState("");
  const [horizon, setHorizon] = useState(20);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [category, horizon]);

  async function loadData() {
    setLoading(true);
    try {
      setResult(await api.getRecommendationBacktest({
        category: category || undefined,
        horizon,
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const meta = result?.meta;

  return (
    <div className="fade-in">
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "var(--space-xs)" }}>
          推薦回測
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          檢視推薦分類在不同持有天期後的歷史表現
        </p>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: "var(--space-lg)" }}>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 4, color: "var(--text-primary)" }}>
          <option value="">全部分類</option>
          <option value="CORE_WATCH">核心觀察</option>
          <option value="PARTIAL_ENTRY">可分批布局</option>
          <option value="SHORT_TERM">短線觀察</option>
          <option value="HIGH_RISK">風險偏高</option>
        </select>
        <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} style={{ padding: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 4, color: "var(--text-primary)" }}>
          <option value={5}>5 日</option>
          <option value={20}>20 日</option>
          <option value={60}>60 日</option>
        </select>
      </div>

      {meta && (
        <div className="grid-4" style={{ marginBottom: "var(--space-xl)" }}>
          <div className="stat-card"><div className="data-label">樣本數</div><div className="data-value lg">{meta.total}</div></div>
          <div className="stat-card"><div className="data-label">勝率</div><div className="data-value lg">{formatChangePercent(meta.winRate)}</div></div>
          <div className="stat-card"><div className="data-label">平均報酬</div><div className={`data-value lg ${getPriceClass(meta.avgReturn)}`}>{formatChangePercent(meta.avgReturn)}</div></div>
          <div className="stat-card"><div className="data-label">最大回撤</div><div className="data-value lg price-down">{formatChangePercent(meta.maxDrawdown)}</div></div>
        </div>
      )}

      <div className="card">
        <div className="card-header"><span className="card-title">回測樣本</span></div>
        {loading ? (
          <div style={{ padding: 20, textAlign: "center" }}>載入中...</div>
        ) : !result?.data?.length ? (
          <div className="empty-state"><p>目前沒有足夠歷史資料</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>股票</th>
                <th>分類</th>
                <th style={{ textAlign: "right" }}>進場</th>
                <th style={{ textAlign: "right" }}>出場</th>
                <th style={{ textAlign: "right" }}>報酬</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((trade: any) => (
                <tr key={`${trade.symbol}-${trade.date}`}>
                  <td>{new Date(trade.date).toLocaleDateString()}</td>
                  <td><div style={{ fontWeight: 600 }}>{trade.name}</div><div className="mono" style={{ color: "var(--color-accent)", fontSize: "0.78rem" }}>{trade.symbol}</div></td>
                  <td>{getCategoryLabel(trade.category)}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{formatPrice(trade.entryPrice)}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{formatPrice(trade.exitPrice)}</td>
                  <td className={`mono ${getPriceClass(trade.returnPercent)}`} style={{ textAlign: "right" }}>{formatChangePercent(trade.returnPercent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
