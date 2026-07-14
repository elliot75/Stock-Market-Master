# 台股分析大師 (Stock-Market-Master) 📈

這是一個專為台灣股市設計的現代化、響應式全棧分析系統。透過自動化的資料爬取與多維度的量化評估，幫助投資者快速鎖定潛力股票。

---

## 🌟 系統特色與功能

### 1. 市場分析與推薦
- **今日推薦**：根據獨家演算法（基本面、技術面、籌碼面）每日自動篩選「核心持股」、「短線操作」等優質標的。
- **市場總覽**：視覺化呈現大盤趨勢、漲跌分佈與市場即時動態。

### 2. 深度個股分析
- **技術指標**：自動計算 MA5/10/20/60、RSI、KD、MACD 以及乖離率。
- **三層評分模型**：
  - **優質股分數 (Quality)**：側重營收與基本面穩定度。
  - **進場時機 (Timing)**：基於技術指標與均線排列判斷強度。
  - **風險評估 (Risk)**：監控乖離率與市場過熱情形。

### 3. 個人化管理
- **自選股系統**：支援多個清單管理、重新命名、排序與移除功能。
- **提醒中心**：可設定價位提醒與條件變化通知。

### 4. 強大的選股器 (Screener)
- 支援價格、成交量、指標與分類的多維度過濾功能。

### 5. 響應式設計 (RWD)
- **桌面版**：完整側邊欄導航，資訊展示更全面。
- **手機版**：自動轉為**底部導航列 (Bottom Navigation)**，操作直覺流暢，表格支援水平滑動。

---

## 🛠️ 系統架構

本專案採用 **Turborepo** 進行 Monorepo 管理：

- **`apps/web`** (Next.js): 現代化的前端界面，使用 Vanilla CSS 打造極致效能。
- **`apps/api`** (Fastify): 高性能的後端 API 服務，負責業務邏輯與資料存取。
- **`apps/worker`** (Node-cron): 負責背景任務，包含資料同步、指標計算與提醒觸發。
- **`packages/database`** (Prisma + PostgreSQL): 資料建模與遷移工具。

---

## 📊 資料來源

系統整合了多個公開資料來源：
- **TWSE OpenAPI**：每日收盤價、三大法人買賣超、融資融券等。
- **Yahoo Finance**：主要用於歷史資料回填 (History Backfill)。
- **FinMind**：備用資料源，支援營收與更豐富的個股數據。

---

## 🚀 快速開始

### 環境變數
請參考 `.env.example` 建立 `.env` 檔案，並填入資料庫連接字串（建議使用 Supabase）與相關 API Token。

通知渠道與 AI 分析需要額外設定：

- `APP_ENCRYPTION_KEY`：以 `openssl rand -base64 32` 產生；Telegram／LINE 憑證會以此加密保存。
- AI：設定自訂 `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`，或設定 `OPENAI_*`、`XAI_*`、`GEMINI_*` 任一組。金鑰只存在伺服器端，使用者只會看到可用供應商與模型。
- ChatGPT、Grok、Gemini 的消費型訂閱與開發者 API 計費可能分離；請使用各供應商的正式 API key。

### 安裝與啟動
```bash
# 安裝依賴
npm install

# 啟動開發模式 (包含 API, Web, Worker)
npm run dev
```

### Telegram 設定與測試

1. 以 BotFather 建立 Bot，取得 Bot Token。
2. 先在 Telegram 打開該 Bot 並傳送 `/start`，或將 Bot 加入目標群組。
3. 在「提醒中心」填入 Bot Token 與 Chat ID 後儲存，再按「測試」。Token 已設定時重新儲存可留白，不會覆寫既有憑證。

### AI 個股分析

登入後，在個股頁選擇已啟用的 LLM provider，即可產生以本系統技術、籌碼、營收及財報資料為基礎的報告並繼續追問。報告依資料版本快取；對話僅自己可見，30 天未活動後自動清除。AI 結果僅供研究，不構成投資建議。

---

## 🔄 資料回補 (Data Backfilling)

在新環境部署或開發階段遺漏資料時，可以使用我們內建的 Yahoo Finance 回補腳本。

進入 `apps/worker` 目錄：
```bash
cd apps/worker
```

**執行回補命令：**
```bash
# 補齊最近 5 天資料 (快速)
npx tsx src/scripts/seedYahooHistory.ts 5d

# 補齊最近 1 個月資料
npx tsx src/scripts/seedYahooHistory.ts 1mo

# 補齊 1 年歷史資料 (預設)
npm run script:seed-yahoo
```

**回補後的計算流程：**
建議在補完價格資料後，手動跑一次計算任務：
1. `npm run job:sync-institutional` (同步籌碼)
2. `npm run job:calc-indicators` (計算技術指標)
3. `npm run job:calc-scores` (計算全股評分)

---

## 🚢 部署說明

本系統支援多種部署方式，你可以選擇雲端平台或在自己的伺服器上自行部署。

### 1. 資料庫準備
無論使用何種部署方式，皆需先準備好 PostgreSQL 資料庫：
- **雲端**：建議使用 Supabase 或 Railway。
- **本地/自行部署**：使用 Docker 執行 `postgres:15-alpine`。
- **初始化**：在根目錄執行 `npx prisma db push` 以同步資料表結構。

新安裝請改用 migration：

```bash
npm run db:migrate:deploy -w @repo/database
```

既有資料庫請先完整備份，再執行一次 baseline 登記，之後即可安全套用增量 migration：

```bash
npm run db:baseline-existing -w @repo/database
npm run db:migrate:deploy -w @repo/database
npm run script:encrypt-notifications -w api
```

`db:baseline-existing` 會先檢查現有主要資料表；請只對本專案既有 schema 執行。不要用 `docker compose down -v`，它會移除 PostgreSQL volume 與所有資料。

### 2. 自行部署 (Git Clone)
如果你想在自己的伺服器上手動執行：
```bash
# 1. 複製專案
git clone https://github.com/elliot75/Stock-Market-Master.git
cd Stock-Market-Master

# 2. 安裝與編譯
npm install
npm run build

# 3. 啟動服務 (需分別啟動或使用 PM2)
# 啟動 API
npm run start -w api
# 啟動 Web
npm run start -w web
# 啟動 Worker
npm run start -w worker
```

### 3. Docker 部署
本專案提供 `docker-compose.yml` 範本，可一鍵啟動完整環境（含資料庫）：
```bash
# 啟動所有服務
docker-compose up -d
```
*註：Compose 會先等待資料庫健康、執行 migration 及通知憑證加密轉換，才啟動 API 與 Worker。部署前請確保 `.env` 的 `APP_ENCRYPTION_KEY` 與所需 LLM／JWT 設定正確。*

GitHub Actions 也會在 `main` 與版本標籤發布 API、Web、Worker images 到 GHCR；伺服器可使用 `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` 取得已發布映像。

### 4. 雲端平台部署 (Vercel / Railway / Render)
- **Web (前端)**：可部署於 Vercel，設定 `NEXT_PUBLIC_API_URL` 指向你的 API 地址。
- **API (後端) 與 Worker**：可部署於 Railway 或 Render 等支援 Node.js 的環境。
- **環境變數**：請務必設定 `.env.example` 中要求的所有變數。

---

## 📝 開發進度
- [x] 完整 CRUD 自選股管理
- [x] 響應式手機介面與底部導航
- [x] Yahoo Finance 資料回補腳本
- [x] 自動化指標計算系統
- [x] 實時盤中價位對接
- [x] LINE / Telegram 通知整合與發送紀錄
- [x] 個股 AI 分析、追問與多供應商設定
- [x] 盤中價位提醒（每 5 分鐘）
- [x] Prisma migration、Docker migration service 與通知憑證加密

---
*本系統僅供學術研究與個人使用，投資有風險，入市需謹慎。*
