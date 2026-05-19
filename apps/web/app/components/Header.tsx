"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "../lib/api";

const AUTH_CHANGE_EVENT = "stock-market-auth-change";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkUser = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        const cachedUser = localStorage.getItem("user");
        if (cachedUser) {
          try {
            setUser(JSON.parse(cachedUser));
          } catch {
            localStorage.removeItem("user");
          }
        }

        try {
          const data = await api.getMe(token);
          setUser(data);
          localStorage.setItem("user", JSON.stringify(data));
        } catch (err) {
          console.error("Failed to fetch user:", err);
          if (!cachedUser) {
            setUser(null);
          }
        }
      } else {
        setUser(null);
      }
      setIsLoaded(true);
    };

    checkUser();
    
    // storage 只會同步其他分頁；自訂事件用來同步同一分頁登入/登出。
    window.addEventListener("storage", checkUser);
    window.addEventListener(AUTH_CHANGE_EVENT, checkUser);
    return () => {
      window.removeEventListener("storage", checkUser);
      window.removeEventListener(AUTH_CHANGE_EVENT, checkUser);
    };
  }, [pathname]);

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const data = await api.searchStocks(query);
        setResults(data);
        setShowResults(true);
      } catch {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setShowProfileMenu(false);
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
    router.push("/");
  };

  return (
    <header className="app-header">
      <div className="header-search" ref={searchRef} style={{ position: "relative" }}>
        <span style={{ color: "var(--text-muted)" }}>🔍</span>
        <input
          type="text"
          placeholder="搜尋股票代號或名稱..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
        />

        {showResults && results.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              marginTop: 4,
              background: "var(--bg-card)",
              border: "1px solid var(--border-primary)",
              borderRadius: "var(--radius-md)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              zIndex: 200,
              maxHeight: 300,
              overflowY: "auto",
            }}
          >
            {results.map((r: any) => (
              <div
                key={r.symbol}
                className="search-result-item"
                onClick={() => {
                  router.push(`/stocks/${r.symbol}`);
                  setShowResults(false);
                  setQuery("");
                }}
              >
                <div>
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                  <span className="symbol-hint">{r.symbol}</span>
                </div>
                <span className="market-badge">
                  {r.marketType === "TWSE" ? "上市" : "上櫃"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="header-actions">
        <span className="header-date hide-mobile">
          {new Date().toLocaleDateString("zh-TW", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            weekday: "short",
          })}
        </span>
        
        {!isLoaded ? (
          <div className="skeleton" style={{ width: 40, height: 40, borderRadius: "50%" }}></div>
        ) : user ? (
          <div className="profile-container" ref={profileRef} style={{ position: "relative" }}>
            <div 
              className="user-avatar" 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              style={{ cursor: "pointer" }}
            >
              {user.displayName?.[0] || user.email?.[0].toUpperCase() || "U"}
            </div>
            
            {showProfileMenu && (
              <div className="profile-dropdown">
                <div className="profile-info">
                  <div className="profile-name">{user.displayName || "使用者"}</div>
                  <div className="profile-email">{user.email}</div>
                </div>
                <div className="profile-divider"></div>
                <div className="profile-menu-item" onClick={() => { router.push("/profile"); setShowProfileMenu(false); }}>
                  👤 個人資料維護
                </div>
                <div className="profile-menu-item" onClick={handleLogout} style={{ color: "var(--color-down)" }}>
                  🚪 登出系統
                </div>
              </div>
            )}
          </div>
        ) : (
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => router.push("/login")}
          >
            登入
          </button>
        )}
      </div>

      <style jsx>{`
        .search-result-item {
          padding: 8px 12px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-primary);
          transition: background 0.15s;
        }
        .search-result-item:hover {
          background: var(--bg-card-hover);
        }
        .symbol-hint {
          margin-left: 8px;
          font-family: var(--font-mono);
          color: var(--color-accent);
          fontSize: 0.82rem;
        }
        .market-badge {
          font-size: 0.72rem;
          color: var(--text-muted);
        }
        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--color-accent);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: #fff;
          transition: transform 0.2s;
        }
        .user-avatar:hover {
          transform: scale(1.05);
        }
        .profile-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 10px;
          background: var(--bg-card);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          min-width: 200px;
          z-index: 1000;
          overflow: hidden;
          animation: slideDown 0.2s ease-out;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .profile-info {
          padding: 12px 16px;
        }
        .profile-name {
          font-weight: 600;
          font-size: 0.9rem;
        }
        .profile-email {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .profile-divider {
          height: 1px;
          background: var(--border-primary);
        }
        .profile-menu-item {
          padding: 10px 16px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        .profile-menu-item:hover {
          background: var(--bg-card-hover);
        }
        .header-date {
          font-size: 0.78rem;
          color: var(--text-muted);
        }
        .skeleton {
          background: linear-gradient(90deg, var(--bg-card) 25%, var(--border-primary) 50%, var(--bg-card) 75%);
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
        }
        @keyframes loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </header>
  );
}
