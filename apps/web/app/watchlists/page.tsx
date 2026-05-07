"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";
import { useRealtimeQuotes } from "../hooks/useRealtimeQuotes";
import {
  formatPrice,
  formatChangePercent,
  getPriceClass,
  getCategoryLabel,
  getCategoryBadgeClass,
  getScoreColor,
  formatDate,
} from "../lib/format";

export default function WatchlistsPage() {
  const router = useRouter();
  const [watchlists, setWatchlists] = useState<any[]>([]);
  const [selectedList, setSelectedList] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [token, setToken] = useState("");

  const symbolsToPoll = selectedList?.items ? selectedList.items.map((i: any) => i.symbol) : [];
  const { quotes, prevQuotes } = useRealtimeQuotes(symbolsToPoll, 15000);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) {
      setToken(t);
      loadWatchlists(t);
    } else {
      setLoading(false);
    }
  }, []);

  async function loadWatchlists(t: string) {
    setLoading(true);
    try {
      const lists = await api.getWatchlists(t);
      setWatchlists(lists);
      if (lists.length > 0 && !selectedList) {
        const detail = await api.getWatchlist(lists[0].id, t);
        setSelectedList(detail);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateList() {
    if (!newName.trim() || !token) return;
    try {
      await api.createWatchlist(newName.trim(), token);
      setNewName("");
      setShowCreate(false);
      loadWatchlists(token);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSelectList(id: string) {
    if (!token) return;
    try {
      const detail = await api.getWatchlist(id, token);
      setSelectedList(detail);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteList(id: string, name: string) {
    if (!confirm(`確定要刪除「${name}」清單嗎？\n此操作會將清單內的所有股票一併移除，且無法復原。`)) return;
    try {
      await api.deleteWatchlist(id, token);
      if (selectedList?.id === id) setSelectedList(null);
      loadWatchlists(token);
    } catch (err) {
      console.error(err);
      alert("刪除失敗");
    }
  }

  async function handleUpdateList(id: string) {
    if (!editName.trim()) {
      setEditingListId(null);
      return;
    }
    try {
      await api.updateWatchlist(id, editName.trim(), token);
      setEditingListId(null);
      if (selectedList?.id === id) {
        setSelectedList({ ...selectedList, name: editName.trim() });
      }
      loadWatchlists(token);
    } catch (err) {
      console.error(err);
      alert("重新命名失敗");
    }
  }

  async function handleRemoveItem(watchlistId: string, itemId: string, symbol: string) {
    if (!confirm(`確定要從清單中移除 ${symbol} 嗎？`)) return;
    try {
      await api.removeFromWatchlist(watchlistId, itemId, token);
      handleSelectList(watchlistId);
      loadWatchlists(token);
    } catch (err) {
      console.error(err);
      alert("移除失敗");
    }
  }

  if (!token) {
    return (
      <div className="fade-in">
        <div className="empty-state" style={{ height: "60vh" }}>
          <div className="icon">🔐</div>
          <p>請先登入以使用自選股功能</p>
          <button className="btn btn-primary" onClick={() => router.push("/login")}>
            前往登入
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-xl)" }}>
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "var(--space-xs)" }}>
            ⭐ 自選股管理
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            建立多個清單，追蹤你關注的股票
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          + 新增清單
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: "var(--space-lg)", padding: "var(--space-lg)" }}>
          <div style={{ display: "flex", gap: "var(--space-sm)" }}>
            <input
              className="form-input"
              placeholder="清單名稱 (如：短線觀察、長線存股)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateList()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={handleCreateList}>
              建立
            </button>
            <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>
              取消
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "var(--space-lg)" }}>
        {/* 左側：清單列表 */}
        <div style={{ width: 220, flexShrink: 0 }}>
          {loading ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : watchlists.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "var(--space-xl)" }}>
              尚無清單，點擊上方按鈕建立
            </div>
          ) : (
            watchlists.map((w) => (
              <div
                key={w.id}
                style={{
                  padding: "var(--space-md)",
                  background: selectedList?.id === w.id ? "var(--color-accent-bg)" : "transparent",
                  borderLeft: selectedList?.id === w.id ? "3px solid var(--color-accent)" : "3px solid transparent",
                  borderBottom: "1px solid var(--border-primary)",
                  transition: "all 0.15s",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-xs)"
                }}
              >
                {editingListId === w.id ? (
                  <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                    <input
                      className="form-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleUpdateList(w.id)}
                      autoFocus
                      style={{ padding: "4px 8px", fontSize: "0.85rem", flex: 1 }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={() => handleUpdateList(w.id)} style={{ padding: "4px" }} title="儲存">✓</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingListId(null)} style={{ padding: "4px" }} title="取消">✕</button>
                  </div>
                ) : (
                  <>
                    <div 
                      style={{ fontWeight: 600, fontSize: "0.9rem", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
                      onClick={() => handleSelectList(w.id)}
                    >
                      <span style={{ flex: 1, wordBreak: "break-all" }}>{w.name}</span>
                      <div style={{ display: "flex", gap: "2px", marginTop: "-2px" }} onClick={(e) => e.stopPropagation()}>
                        <button 
                          className="btn btn-ghost btn-sm" 
                          style={{ padding: "2px 6px", fontSize: "0.8rem", color: "var(--text-muted)" }}
                          onClick={() => { setEditingListId(w.id); setEditName(w.name); }}
                          title="重新命名"
                        >
                          ✎
                        </button>
                        <button 
                          className="btn btn-ghost btn-sm" 
                          style={{ padding: "2px 6px", fontSize: "0.8rem", color: "var(--color-danger)" }}
                          onClick={() => handleDeleteList(w.id, w.name)}
                          title="刪除清單"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {w.itemCount} 檔股票
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* 右側：清單內容 */}
        <div style={{ flex: 1 }}>
          {selectedList ? (
            <div className="card">
              <div className="card-header">
                <span className="card-title">{selectedList.name}</span>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  {selectedList.items?.length || 0} 檔
                </span>
              </div>
              {selectedList.items?.length === 0 ? (
                <div className="empty-state">
                  <div className="icon">📭</div>
                  <p>此清單尚無股票</p>
                  <p style={{ fontSize: "0.78rem" }}>
                    透過搜尋功能找到股票後，可加入此清單
                  </p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>股票</th>
                      <th style={{ textAlign: "right" }}>現價</th>
                      <th style={{ textAlign: "right" }}>漲跌幅</th>
                      <th style={{ textAlign: "center" }}>評分</th>
                      <th style={{ textAlign: "center" }}>分類</th>
                      <th>加入原因</th>
                      <th>加入日期</th>
                      <th style={{ textAlign: "center" }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedList.items?.map((item: any) => {
                      const rtQuote = quotes[item.symbol];
                      const prevRtQuote = prevQuotes[item.symbol];
                      
                      const displayPrice = rtQuote ? rtQuote.price : item.price?.close;
                      const displayChange = rtQuote ? rtQuote.change : item.price?.change;
                      const displayChangePercent = rtQuote ? rtQuote.changePercent : item.price?.changePercent;
                      
                      let flashClass = "";
                      if (rtQuote && prevRtQuote && rtQuote.price !== prevRtQuote.price) {
                        flashClass = rtQuote.price > prevRtQuote.price ? "flash-up" : "flash-down";
                      }

                      return (
                      <tr
                        key={item.id}
                        style={{ cursor: "pointer" }}
                        onClick={() => router.push(`/stocks/${item.symbol}`)}
                      >
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--color-accent)", fontFamily: "var(--font-mono)" }}>
                            {item.symbol}
                          </div>
                        </td>
                        <td className={`mono ${getPriceClass(displayChange)} ${flashClass}`} style={{ textAlign: "right" }}>
                          {formatPrice(displayPrice)}
                        </td>
                        <td className={`mono ${getPriceClass(displayChange)} ${flashClass}`} style={{ textAlign: "right" }}>
                          {formatChangePercent(displayChangePercent)}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {item.score ? (
                            <span className="mono" style={{ fontWeight: 700, color: getScoreColor(item.score.compositeScore) }}>
                              {Math.round(item.score.compositeScore)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {item.score?.category && (
                            <span className={getCategoryBadgeClass(item.score.category)}>
                              {getCategoryLabel(item.score.category)}
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: "0.78rem", color: "var(--text-secondary)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {item.addedReason || "-"}
                        </td>
                        <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                          {formatDate(item.addedAt)}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: "4px 8px", color: "var(--color-danger)" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveItem(selectedList.id, item.id, item.symbol);
                            }}
                            title="從清單中移除"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <div className="icon">👈</div>
              <p>選擇左側清單以查看內容</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
