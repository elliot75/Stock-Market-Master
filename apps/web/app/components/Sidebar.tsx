"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  {
    section: "分析中心",
    items: [
      { href: "/", label: "今日推薦", icon: "🏠" },
      { href: "/market", label: "市場總覽", icon: "📊" },
      { href: "/screener", label: "條件選股", icon: "🔍" },
      { href: "/backtest", label: "推薦回測", icon: "📈" },
    ],
  },
  {
    section: "個人功能",
    items: [
      { href: "/watchlists", label: "自選股", icon: "⭐" },
      { href: "/portfolio", label: "持倉追蹤", icon: "💼" },
      { href: "/alerts", label: "提醒中心", icon: "🔔" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 避免 SSR hydration mismatch，使用 useEffect 來載入本地設定
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") {
      setIsCollapsed(true);
      document.documentElement.style.setProperty("--sidebar-width", "64px");
    }
  }, []);

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem("sidebar-collapsed", nextState.toString());
    if (nextState) {
      document.documentElement.style.setProperty("--sidebar-width", "64px");
    } else {
      document.documentElement.style.setProperty("--sidebar-width", "220px");
    }
  };

  return (
    <aside className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
      <div className="sidebar-logo">
        <span className="logo-icon">📈</span>
        <h1 className="sidebar-title-text">台股分析大師</h1>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((section) => (
          <div key={section.section}>
            <div className="sidebar-section-title">{isCollapsed ? "⋯" : section.section}</div>
            {section.items.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link ${isActive ? "active" : ""}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{ borderTop: "1px solid var(--border-primary)", display: "flex", flexDirection: "column" }}>
        <button 
          className="sidebar-toggle-btn"
          onClick={toggleSidebar}
          title={isCollapsed ? "展開選單" : "收合選單"}
        >
          {isCollapsed ? "▶" : "◀"}
        </button>
        <div className="sidebar-footer-text" style={{ padding: "var(--space-md)", fontSize: "0.72rem", color: "var(--text-muted)", textAlign: "center" }}>
          台股分析大師 v0.1
          <br />
          資料來源：TWSE / TPEx / FinMind
        </div>
      </div>
    </aside>
  );
}
