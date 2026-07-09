"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  
  // Profile form
  const [displayName, setDisplayName] = useState("");
  
  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) {
      router.push("/login");
      return;
    }
    setToken(t);
    api.getMe(t)
      .then(data => {
        setUser(data);
        setDisplayName(data.displayName || "");
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem("token");
        router.push("/login");
      });
  }, [router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const updatedUser = await api.updateMe({ displayName }, token);
      setUser(updatedUser);
      alert("個人資料已更新！");
    } catch (err: any) {
      alert(err.message || "更新失敗");
    } finally {
      setUpdating(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert("新密碼與確認密碼不符");
      return;
    }
    setUpdating(true);
    try {
      await api.changePassword({ currentPassword, newPassword }, token);
      alert("密碼已修改！");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      alert(err.message || "修改失敗");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div className="fade-in profile-page" style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "var(--space-xs)" }}>
          👤 個人資料維護
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          管理你的個人帳戶、修改暱稱與安全性設定
        </p>
      </div>

      <div className="grid-2" style={{ gap: "var(--space-lg)", alignItems: "start" }}>
        {/* 基本資料 */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">基本資料</span>
          </div>
          <div className="card-body">
            <form onSubmit={handleUpdateProfile}>
              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Email 帳號</label>
                <input 
                  type="text" 
                  value={user?.email || ""} 
                  disabled 
                  style={{ width: "100%", padding: 10, background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 4, color: "var(--text-muted)" }}
                />
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>帳號不開放修改</p>
              </div>
              <div style={{ marginBottom: 24 }}>
                <label className="input-label">顯示暱稱</label>
                <input 
                  type="text" 
                  value={displayName} 
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="輸入你想顯示的名稱"
                  className="form-input"
                  style={{ width: "100%", padding: 10, background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 4, color: "var(--text-primary)" }}
                />
              </div>
              <button className="btn btn-primary w-full" type="submit" disabled={updating}>
                {updating ? "處理中..." : "儲存修改"}
              </button>
            </form>
          </div>
        </div>

        {/* 修改密碼 */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">安全性設定</span>
          </div>
          <div className="card-body">
            <form onSubmit={handleChangePassword}>
              <div style={{ marginBottom: 12 }}>
                <label className="input-label">目前密碼</label>
                <input 
                  type="password" 
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="form-input"
                  required
                  style={{ width: "100%", padding: 10, background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 4, color: "var(--text-primary)" }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label className="input-label">新密碼</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="form-input"
                  required
                  placeholder="至少 6 個字元"
                  style={{ width: "100%", padding: 10, background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 4, color: "var(--text-primary)" }}
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label className="input-label">確認新密碼</label>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="form-input"
                  required
                  style={{ width: "100%", padding: 10, background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 4, color: "var(--text-primary)" }}
                />
              </div>
              <button className="btn btn-outline w-full" type="submit" disabled={updating}>
                {updating ? "處理中..." : "修改密碼"}
              </button>
            </form>
          </div>
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
