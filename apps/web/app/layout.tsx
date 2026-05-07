import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

export const metadata: Metadata = {
  title: "台股分析大師 - 智慧選股與深度診斷",
  description:
    "台灣股票市場分析系統，提供優質股推薦、技術面與籌碼面深度分析、自選股管理與條件選股功能。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div className="app-layout">
          <Sidebar />
          <div className="app-main">
            <Header />
            <main className="app-content">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
