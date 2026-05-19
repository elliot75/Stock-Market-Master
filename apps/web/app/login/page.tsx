"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let result;
      if (mode === "login") {
        result = await api.login(email, password);
      } else {
        result = await api.register(email, password, displayName || undefined);
      }

      localStorage.setItem("token", result.token);
      localStorage.setItem("user", JSON.stringify(result.user));
      window.dispatchEvent(new Event("stock-market-auth-change"));
      router.push("/");
    } catch (err: any) {
      setError(err.message || "操作失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - var(--header-height))",
      }}
    >
      <div className="auth-card fade-in">
        <div style={{ textAlign: "center", marginBottom: "var(--space-xl)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "var(--space-sm)" }}>📈</div>
          <h1 className="auth-title">
            {mode === "login" ? "登入" : "註冊帳號"}
          </h1>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <div className="form-group">
              <label className="form-label">顯示名稱</label>
              <input
                className="form-input"
                type="text"
                placeholder="你的名稱"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">密碼</label>
            <input
              className="form-input"
              type="password"
              placeholder="至少 6 位"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && (
            <div
              style={{
                padding: "var(--space-sm) var(--space-md)",
                background: "var(--color-danger-bg)",
                color: "var(--color-danger)",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.82rem",
                marginBottom: "var(--space-lg)",
              }}
            >
              {error}
            </div>
          )}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "var(--space-md)" }}
          >
            {loading ? "處理中..." : mode === "login" ? "登入" : "註冊"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "var(--space-lg)" }}>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "還沒有帳號？點此註冊" : "已有帳號？點此登入"}
          </button>
        </div>
      </div>
    </div>
  );
}
