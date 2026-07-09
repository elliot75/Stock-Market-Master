"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";
import { formatPrice, formatChangePercent, getPriceClass } from "../lib/format";

const HOLDING_FIELDS = [
  ["symbol", "股票代號", "2330"],
  ["shares", "股數", "1000"],
  ["averageCost", "平均成本", "600"],
  ["targetPrice", "目標價", "700"],
  ["stopLoss", "停損價", "560"],
] as const;

export default function PortfolioPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [holdings, setHoldings] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    symbol: "",
    shares: "",
    averageCost: "",
    targetPrice: "",
    stopLoss: "",
    note: "",
  });

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) {
      setLoading(false);
      return;
    }
    setToken(t);
    loadHoldings(t);
  }, []);

  async function loadHoldings(t: string) {
    setLoading(true);
    try {
      const [holdingData, summaryData] = await Promise.all([
        api.getHoldings(t),
        api.getPortfolioSummary(t),
      ]);
      setHoldings(holdingData);
      setSummary(summaryData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.saveHolding({
        symbol: form.symbol.trim(),
        shares: Number(form.shares),
        averageCost: Number(form.averageCost),
        targetPrice: form.targetPrice ? Number(form.targetPrice) : undefined,
        stopLoss: form.stopLoss ? Number(form.stopLoss) : undefined,
        note: form.note || undefined,
      }, token);
      setForm({ symbol: "", shares: "", averageCost: "", targetPrice: "", stopLoss: "", note: "" });
      loadHoldings(token);
    } catch (err: any) {
      alert(err.message || "儲存失敗");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("確定刪除此持倉？")) return;
    try {
      await api.deleteHolding(id, token);
      setHoldings(holdings.filter((holding) => holding.id !== id));
    } catch (err: any) {
      alert(err.message || "刪除失敗");
    }
  }

  if (!token) {
    return (
      <div className="fade-in">
        <div className="empty-state" style={{ height: "60vh" }}>
          <div className="icon">🔐</div>
          <p>請先登入以使用持倉追蹤</p>
          <button className="btn btn-primary" onClick={() => router.push("/login")}>前往登入</button>
        </div>
      </div>
    );
  }

  const totalMarketValue = holdings.reduce((sum, h) => sum + (h.marketValue || 0), 0);
  const totalCost = holdings.reduce((sum, h) => sum + (h.costValue || 0), 0);
  const totalPnl = totalMarketValue - totalCost;
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  return (
    <div className="fade-in">
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "var(--space-xs)" }}>
          持倉追蹤
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          管理平均成本、目標價與停損距離
        </p>
      </div>

      <div className="grid-4" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="stat-card">
          <div className="data-label">市值</div>
          <div className="data-value lg">{formatPrice(totalMarketValue)}</div>
        </div>
        <div className="stat-card">
          <div className="data-label">成本</div>
          <div className="data-value lg">{formatPrice(totalCost)}</div>
        </div>
        <div className="stat-card">
          <div className="data-label">未實現損益</div>
          <div className={`data-value lg ${getPriceClass(totalPnl)}`}>{formatPrice(totalPnl)}</div>
        </div>
        <div className="stat-card">
          <div className="data-label">報酬率</div>
          <div className={`data-value lg ${getPriceClass(totalPnlPercent)}`}>{formatChangePercent(totalPnlPercent)}</div>
        </div>
      </div>

      {summary && summary.valuedHoldingCount > 0 && (
        <div className="grid-4" style={{ marginBottom: "var(--space-xl)" }}>
          <div className="stat-card">
            <div className="data-label">集中度</div>
            <div className="data-value lg">
              {summary.concentrationLevel === "high"
                ? "偏高"
                : summary.concentrationLevel === "medium"
                  ? "中等"
                  : "分散"}
            </div>
          </div>
          <div className="stat-card">
            <div className="data-label">第一大持倉</div>
            <div className="data-value lg">{formatChangePercent(summary.topHoldingPercent)}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
              {summary.topHolding?.symbol || "-"}
            </div>
          </div>
          <div className="stat-card">
            <div className="data-label">前三大占比</div>
            <div className="data-value lg">{formatChangePercent(summary.topThreePercent)}</div>
          </div>
          <div className="stat-card">
            <div className="data-label">最大產業曝險</div>
            <div className="data-value lg">
              {summary.industryExposure?.[0]
                ? formatChangePercent(summary.industryExposure[0].percent)
                : "-"}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
              {summary.industryExposure?.[0]?.industry || "-"}
            </div>
          </div>
        </div>
      )}

      <div className="grid-2" style={{ gap: "var(--space-lg)", alignItems: "start" }}>
        <div className="card">
          <div className="card-header"><span className="card-title">新增 / 更新持倉</span></div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              {HOLDING_FIELDS.map(([key, label, placeholder]) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <label className="input-label">{label}</label>
                  <input
                    className="form-input"
                    type={key === "symbol" ? "text" : "number"}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    required={["symbol", "shares", "averageCost"].includes(key)}
                    style={{ width: "100%", padding: 10, background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 4, color: "var(--text-primary)" }}
                  />
                </div>
              ))}
              <div style={{ marginBottom: 16 }}>
                <label className="input-label">備註</label>
                <input
                  className="form-input"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  style={{ width: "100%", padding: 10, background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 4, color: "var(--text-primary)" }}
                />
              </div>
              <button className="btn btn-primary w-full" type="submit">儲存持倉</button>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">持倉明細 ({holdings.length})</span></div>
          {loading ? (
            <div style={{ padding: 20, textAlign: "center" }}>載入中...</div>
          ) : holdings.length === 0 ? (
            <div className="empty-state"><p>尚未建立持倉</p></div>
          ) : (
            <table className="data-table">
              <tbody>
                {holdings.map((holding) => (
                  <tr key={holding.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{holding.name} <span className="mono" style={{ color: "var(--color-accent)", fontSize: "0.8rem" }}>{holding.symbol}</span></div>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                        {holding.shares.toLocaleString()} 股 @ {formatPrice(holding.averageCost)}
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="mono">{formatPrice(holding.latestPrice)}</div>
                      <div className={`mono ${getPriceClass(holding.unrealizedPnl)}`}>
                        {formatPrice(holding.unrealizedPnl)} / {formatChangePercent(holding.unrealizedPnlPercent)}
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => router.push(`/stocks/${holding.symbol}`)}>分析</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(holding.id)} style={{ color: "var(--color-down)" }}>刪除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style jsx>{`
        .input-label {
          display: block;
          margin-bottom: 6px;
          font-size: 0.85rem;
          color: var(--text-secondary);
          font-weight: 500;
        }
        .form-input:focus {
          border-color: var(--color-accent) !important;
          outline: none;
        }
        .w-full {
          width: 100%;
        }
      `}</style>
    </div>
  );
}
