"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function AiAnalysisPanel({ symbol, token }: { symbol: string; token: string }) {
  const [providers, setProviders] = useState<Array<{ id: string; label: string; model: string; isDefault: boolean }>>([]);
  const [providerId, setProviderId] = useState("");
  const [report, setReport] = useState<any>(null);
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    api.getAiProviders(token).then((items) => {
      setProviders(items);
      setProviderId(items.find((item) => item.isDefault)?.id || items[0]?.id || "");
    }).catch((err) => setError(err.message || "無法讀取 AI 設定"));
  }, [token]);

  async function generate(forceRefresh = false) {
    if (!token) return;
    setLoading(true); setError("");
    try {
      const result = await api.generateAiAnalysis(symbol, { providerId, forceRefresh }, token);
      setReport(result);
      setConversationId(result.conversationId);
      const conversation = await api.getAiConversation(result.conversationId, token);
      setMessages(conversation.messages || []);
    } catch (err: any) {
      setError(err.message || "AI 分析失敗");
    } finally {
      setLoading(false);
    }
  }

  async function ask() {
    if (!question.trim() || !conversationId) return;
    setLoading(true); setError("");
    try {
      const answer = await api.sendAiMessage(conversationId, question.trim(), token);
      setMessages((items) => [...items, { role: "USER", content: question.trim(), id: `pending-${Date.now()}` }, answer]);
      setQuestion("");
    } catch (err: any) {
      setError(err.message || "AI 追問失敗");
    } finally {
      setLoading(false);
    }
  }

  async function clearConversation() {
    if (!conversationId) return;
    try {
      await api.deleteAiConversation(conversationId, token);
      setConversationId(""); setMessages([]);
    } catch (err: any) {
      setError(err.message || "刪除對話失敗");
    }
  }

  if (!token) {
    return <div className="card" style={{ marginBottom: "var(--space-md)" }}><div className="card-body">🤖 登入後可使用 AI 個股分析與追問功能。</div></div>;
  }

  return (
    <section className="card" style={{ marginBottom: "var(--space-md)" }}>
      <div className="card-header">
        <span className="card-title">🤖 AI 個股分析</span>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={providerId} onChange={(event) => setProviderId(event.target.value)} disabled={loading || providers.length === 0} style={{ maxWidth: 220 }}>
            {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.label} · {provider.model}</option>)}
          </select>
          <button className="btn btn-sm btn-primary" onClick={() => generate(false)} disabled={loading || !providerId}>{loading ? "分析中…" : "產生分析"}</button>
          {report && <button className="btn btn-sm btn-outline" onClick={() => generate(true)} disabled={loading}>重新分析</button>}
        </div>
      </div>
      <div className="card-body">
        {providers.length === 0 && !error && <p style={{ color: "var(--text-muted)" }}>管理員尚未在伺服器設定 LLM provider。</p>}
        {error && <p style={{ whiteSpace: "pre-line", color: "var(--color-down)" }}>{error}</p>}
        {report && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12, fontSize: "0.8rem", color: "var(--text-muted)" }}>
              <span>{report.provider} · {report.model} · 資料日期 {new Date(report.sourceDate).toLocaleDateString()}</span>
              <span>{report.cacheHit ? "使用快取報告" : "剛完成分析"}</span>
            </div>
            <div className="grid-2" style={{ gap: 12 }}>
              <div><div className="data-label">觀點／信心</div><div className="data-value">{report.content.stance} · {report.content.confidence}%</div></div>
              <div><div className="data-label">關鍵價位</div><div className="data-value mono">支撐 {report.content.keyLevels?.support ?? "-"} · 壓力 {report.content.keyLevels?.resistance ?? "-"} · 停損 {report.content.keyLevels?.stopLoss ?? "-"}</div></div>
            </div>
            <p style={{ whiteSpace: "pre-line", marginTop: 12 }}>{report.content.summary}</p>
            <div className="grid-3" style={{ gap: 12, fontSize: "0.85rem" }}>
              <div><strong>技術面</strong><p style={{ whiteSpace: "pre-line" }}>{report.content.technicalView}</p></div>
              <div><strong>基本面</strong><p style={{ whiteSpace: "pre-line" }}>{report.content.fundamentalView}</p></div>
              <div><strong>籌碼面</strong><p style={{ whiteSpace: "pre-line" }}>{report.content.chipView}</p></div>
            </div>
            <div className="grid-2" style={{ gap: 12, fontSize: "0.85rem" }}>
              <div><strong>優勢</strong><ul>{report.content.strengths?.map((item: string) => <li key={item}>{item}</li>)}</ul></div>
              <div><strong>風險與資料限制</strong><ul>{[...(report.content.risks || []), ...(report.content.dataLimitations || [])].map((item: string) => <li key={item}>{item}</li>)}</ul></div>
            </div>
          </div>
        )}
        {conversationId && (
          <div style={{ borderTop: "1px solid var(--border-primary)", marginTop: 16, paddingTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><strong>追問分析</strong><button className="btn btn-sm btn-ghost" onClick={clearConversation}>清除對話</button></div>
            {messages.map((message) => <div key={message.id} style={{ whiteSpace: "pre-line", margin: "8px 0", padding: 10, borderRadius: 6, background: message.role === "USER" ? "var(--bg-input)" : "transparent" }}><strong>{message.role === "USER" ? "你" : "AI"}：</strong>{message.content}</div>)}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input value={question} maxLength={500} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") ask(); }} placeholder="針對這份報告繼續追問（最多 500 字）" style={{ flex: 1 }} disabled={loading} />
              <button className="btn btn-primary" onClick={ask} disabled={loading || !question.trim()}>送出</button>
            </div>
          </div>
        )}
        <p style={{ marginTop: 14, fontSize: "0.75rem", color: "var(--text-muted)" }}>AI 僅依本系統資料協助整理觀點，不構成投資建議；投資前請自行查證並評估風險。</p>
      </div>
    </section>
  );
}
