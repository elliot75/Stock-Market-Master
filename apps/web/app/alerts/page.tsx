"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";

const conditionMap: Record<string, string> = {
  PRICE_ABOVE: "股價突破",
  PRICE_BELOW: "股價跌破",
  VOLUME_SPIKE: "成交量異常放大",
  FOREIGN_NET_BUY: "外資轉買",
  FOREIGN_NET_SELL: "外資轉賣",
  TRUST_NET_BUY: "投信轉買",
  SCORE_UPGRADE: "評分升級",
  SCORE_DOWNGRADE: "評分降級",
  BREAK_SUPPORT: "跌破支撐",
  BREAK_RESISTANCE: "突破壓力",
};

export default function AlertsPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [rules, setRules] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRule, setNewRule] = useState({ symbol: "", conditionType: "PRICE_ABOVE", threshold: "" });
  const [channelForm, setChannelForm] = useState({
    type: "TELEGRAM" as "LINE" | "TELEGRAM",
    name: "Telegram",
    botToken: "",
    chatId: "",
    channelAccessToken: "",
    userId: "",
  });

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) {
      setToken(t);
      loadData(t);
    }
  }, []);

  async function loadData(t: string) {
    setLoading(true);
    try {
      const [r, e, c] = await Promise.all([
        api.getAlertRules(t),
        api.getAlertEvents(t),
        api.getNotificationChannels(t)
      ]);
      setRules(r);
      setEvents(e.data);
      setChannels(c);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleRule(ruleId: string, isActive: boolean) {
    try {
      await api.toggleAlertRule(ruleId, !isActive, token);
      setRules(rules.map(r => r.id === ruleId ? { ...r, isActive: !isActive } : r));
    } catch (err: any) {
      alert(err.message || "更新失敗");
    }
  }

  async function handleDeleteRule(ruleId: string) {
    if (!confirm("確定刪除此規則？")) return;
    try {
      await api.deleteAlertRule(ruleId, token);
      setRules(rules.filter(r => r.id !== ruleId));
    } catch (err: any) {
      alert(err.message || "刪除失敗");
    }
  }

  async function handleCreateRule() {
    if (!newRule.symbol) return alert("請輸入股票代號");
    try {
      await api.createAlertRule({
        symbol: newRule.symbol,
        conditionType: newRule.conditionType,
        threshold: newRule.threshold ? parseFloat(newRule.threshold) : undefined
      }, token);
      alert("新增成功");
      setShowAddModal(false);
      setNewRule({ symbol: "", conditionType: "PRICE_ABOVE", threshold: "" });
      loadData(token);
    } catch (err: any) {
      alert(err.message || "新增失敗");
    }
  }

  async function handleMarkRead(eventId: string) {
    try {
      await api.markEventAsRead(eventId, token);
      setEvents(events.map(e => e.id === eventId ? { ...e, isRead: true } : e));
    } catch (err: any) {
      alert(err.message || "標記失敗");
    }
  }

  async function handleMarkAllRead() {
    try {
      await api.markAllEventsAsRead(token);
      setEvents(events.map(e => ({ ...e, isRead: true })));
    } catch (err: any) {
      alert(err.message || "標記失敗");
    }
  }

  async function handleSaveChannel() {
    try {
      const config =
        channelForm.type === "TELEGRAM"
          ? { botToken: channelForm.botToken, chatId: channelForm.chatId }
          : { channelAccessToken: channelForm.channelAccessToken, userId: channelForm.userId };
      await api.saveNotificationChannel({
        type: channelForm.type,
        name: channelForm.name || channelForm.type,
        isActive: true,
        config,
      }, token);
      loadData(token);
      alert("通知渠道已儲存");
    } catch (err: any) {
      alert(err.message || "儲存失敗");
    }
  }

  async function handleTestChannel(channelId: string) {
    try {
      const result = await api.testNotificationChannel({ channelId }, token);
      alert(result.ok ? "測試通知已送出" : result.errorMessage || "測試失敗");
      loadData(token);
    } catch (err: any) {
      alert(err.message || "測試失敗");
    }
  }

  async function handleToggleChannel(channel: any) {
    try {
      await api.updateNotificationChannel(channel.id, !channel.isActive, token);
      loadData(token);
    } catch (err: any) {
      alert(err.message || "更新渠道失敗");
    }
  }

  async function handleDeleteChannel(channelId: string) {
    if (!confirm("確定刪除此通知渠道？")) return;
    try {
      await api.deleteNotificationChannel(channelId, token);
      loadData(token);
    } catch (err: any) {
      alert(err.message || "刪除渠道失敗");
    }
  }

  if (!token) {
    return (
      <div className="fade-in">
        <div className="empty-state" style={{ height: "60vh" }}>
          <div className="icon">🔐</div>
          <p>請先登入以使用提醒功能</p>
          <button className="btn btn-primary" onClick={() => router.push("/login")}>
            前往登入
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "var(--space-xs)" }}>
          🔔 提醒中心
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          設定價位提醒、法人動態通知、分數變化提醒
        </p>
      </div>

      <div className="grid-2" style={{ gap: "var(--space-lg)", alignItems: "start" }}>
        {/* 提醒規則 */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">📋 提醒規則 ({rules.length})</span>
            <button className="btn btn-sm btn-primary" onClick={() => setShowAddModal(true)}>+ 新增規則</button>
          </div>
          {loading ? (
            <div style={{ padding: 20, textAlign: "center" }}>載入中...</div>
          ) : rules.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📌</div>
              <p>尚未設定任何提醒規則</p>
            </div>
          ) : (
            <table className="data-table">
              <tbody>
                {rules.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.stockName} <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{r.symbol}</span></div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        {conditionMap[r.conditionType]} {r.threshold ? `(${r.threshold})` : ""}
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button 
                        className={`btn btn-sm ${r.isActive ? "btn-outline" : "btn-ghost"}`} 
                        onClick={() => handleToggleRule(r.id, r.isActive)}
                        style={{ marginRight: 8, padding: "4px 8px", fontSize: "0.75rem" }}
                      >
                        {r.isActive ? "🟢 啟用中" : "⚪ 已停用"}
                      </button>
                      <button 
                        className="btn btn-sm btn-ghost" 
                        onClick={() => handleDeleteRule(r.id)}
                        style={{ color: "var(--color-down)", padding: "4px 8px", fontSize: "0.75rem" }}
                      >
                        刪除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 觸發通知 */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🔔 觸發通知 ({events.filter(e => !e.isRead).length})</span>
            <button className="btn btn-sm btn-ghost" onClick={handleMarkAllRead}>全部標記已讀</button>
          </div>
          {loading ? (
            <div style={{ padding: 20, textAlign: "center" }}>載入中...</div>
          ) : events.length === 0 ? (
            <div className="empty-state">
              <div className="icon">💤</div>
              <p>目前無通知</p>
            </div>
          ) : (
            <div style={{ maxHeight: 500, overflowY: "auto" }}>
              {events.map(e => (
                <div key={e.id} style={{ 
                  padding: "12px 16px", 
                  borderBottom: "1px solid var(--border-primary)",
                  background: e.isRead ? "transparent" : "var(--bg-card-hover)",
                  display: "flex",
                  gap: 12
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{e.stockName} ({e.symbol}) - {conditionMap[e.conditionType]}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{new Date(e.triggeredAt).toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{e.message}</div>
                    {e.delivery && (
                      <div style={{ marginTop: 4, fontSize: "0.72rem", color: e.delivery.status === "SENT" ? "var(--color-up)" : "var(--color-down)" }}>
                        {e.delivery.channelType}：{e.delivery.status === "SENT" ? "已送達" : `送達失敗${e.delivery.errorMessage ? ` · ${e.delivery.errorMessage}` : ""}`}
                      </div>
                    )}
                  </div>
                  {!e.isRead && (
                    <button className="btn btn-sm btn-ghost" onClick={() => handleMarkRead(e.id)} style={{ alignSelf: "center", fontSize: "0.75rem" }}>
                      標為已讀
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: "var(--space-lg)" }}>
        <div className="card-header">
          <span className="card-title">通知渠道</span>
        </div>
        <div className="card-body">
          <div className="grid-2" style={{ gap: "var(--space-lg)", alignItems: "start" }}>
            <div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem", color: "var(--text-muted)" }}>渠道類型</label>
                <select
                  value={channelForm.type}
                  onChange={(e) => setChannelForm({
                    ...channelForm,
                    type: e.target.value as "LINE" | "TELEGRAM",
                    name: e.target.value === "LINE" ? "LINE" : "Telegram",
                  })}
                  style={{ width: "100%", padding: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 4, color: "var(--text-primary)" }}
                >
                  <option value="TELEGRAM">Telegram</option>
                  <option value="LINE">LINE Messaging API</option>
                </select>
              </div>
              {channelForm.type === "TELEGRAM" ? (
                <>
                  <input
                    placeholder="Bot Token（已設定時可留白保留）"
                    value={channelForm.botToken}
                    onChange={(e) => setChannelForm({ ...channelForm, botToken: e.target.value })}
                    style={{ width: "100%", marginBottom: 8, padding: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 4, color: "var(--text-primary)" }}
                  />
                  <input
                    placeholder="Chat ID"
                    value={channelForm.chatId}
                    onChange={(e) => setChannelForm({ ...channelForm, chatId: e.target.value })}
                    style={{ width: "100%", marginBottom: 12, padding: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 4, color: "var(--text-primary)" }}
                  />
                </>
              ) : (
                <>
                  <input
                    placeholder="Channel Access Token（已設定時可留白保留）"
                    value={channelForm.channelAccessToken}
                    onChange={(e) => setChannelForm({ ...channelForm, channelAccessToken: e.target.value })}
                    style={{ width: "100%", marginBottom: 8, padding: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 4, color: "var(--text-primary)" }}
                  />
                  <input
                    placeholder="User ID"
                    value={channelForm.userId}
                    onChange={(e) => setChannelForm({ ...channelForm, userId: e.target.value })}
                    style={{ width: "100%", marginBottom: 12, padding: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 4, color: "var(--text-primary)" }}
                  />
                </>
              )}
              <button className="btn btn-primary" onClick={handleSaveChannel}>儲存渠道</button>
            </div>
            <div>
              {channels.length === 0 ? (
                <div className="empty-state"><p>尚未設定通知渠道</p></div>
              ) : (
                <table className="data-table">
                  <tbody>
                    {channels.map((channel) => (
                      <tr key={channel.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{channel.name}</div>
                          <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                            {channel.type} {channel.config?.chatId ? `· Chat ID: ${channel.config.chatId}` : ""}
                            {channel.config?.botTokenConfigured || channel.config?.channelAccessTokenConfigured ? " · 憑證已設定" : ""}
                          </div>
                          {channel.lastTestedAt && <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>最近測試：{new Date(channel.lastTestedAt).toLocaleString()}</div>}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button className="btn btn-sm btn-ghost" onClick={() => handleToggleChannel(channel)}>{channel.isActive ? "停用" : "啟用"}</button>{" "}
                          <button className="btn btn-sm btn-outline" onClick={() => handleTestChannel(channel.id)}>測試</button>
                          <button className="btn btn-sm btn-ghost" style={{ color: "var(--color-down)" }} onClick={() => handleDeleteChannel(channel.id)}>刪除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 新增規則 Modal */}
      {showAddModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.6)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div className="card" style={{ width: 400, maxWidth: "90%", background: "var(--bg-body)" }}>
            <div className="card-header">
              <span className="card-title">新增提醒規則</span>
            </div>
            <div className="card-body">
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem", color: "var(--text-muted)" }}>股票代號</label>
                <input 
                  type="text" 
                  value={newRule.symbol}
                  onChange={e => setNewRule({...newRule, symbol: e.target.value})}
                  placeholder="例如: 2330"
                  style={{ width: "100%", padding: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 4, color: "var(--text-primary)" }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem", color: "var(--text-muted)" }}>提醒條件</label>
                <select 
                  value={newRule.conditionType}
                  onChange={e => setNewRule({...newRule, conditionType: e.target.value})}
                  style={{ width: "100%", padding: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 4, color: "var(--text-primary)" }}
                >
                  {Object.entries(conditionMap).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              {(newRule.conditionType.includes("PRICE") || newRule.conditionType.includes("BREAK_")) && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem", color: "var(--text-muted)" }}>觸發數值 (選填)</label>
                  <input 
                    type="number" 
                    value={newRule.threshold}
                    onChange={e => setNewRule({...newRule, threshold: e.target.value})}
                    placeholder="輸入目標價位"
                    style={{ width: "100%", padding: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 4, color: "var(--text-primary)" }}
                  />
                </div>
              )}
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
                <button className="btn btn-ghost" onClick={() => setShowAddModal(false)}>取消</button>
                <button className="btn btn-primary" onClick={handleCreateRule}>確認新增</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
