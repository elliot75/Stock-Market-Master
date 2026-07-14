-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MarketType" AS ENUM ('TWSE', 'TPEX');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELISTED');

-- CreateEnum
CREATE TYPE "RecommendationCategory" AS ENUM ('CORE_WATCH', 'PARTIAL_ENTRY', 'SHORT_TERM', 'HIGH_RISK');

-- CreateEnum
CREATE TYPE "AlertCondition" AS ENUM ('PRICE_ABOVE', 'PRICE_BELOW', 'VOLUME_SPIKE', 'FOREIGN_NET_BUY', 'FOREIGN_NET_SELL', 'TRUST_NET_BUY', 'SCORE_UPGRADE', 'SCORE_DOWNGRADE', 'BREAK_SUPPORT', 'BREAK_RESISTANCE');

-- CreateEnum
CREATE TYPE "NotificationChannelType" AS ENUM ('LINE', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocks" (
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "market_type" "MarketType" NOT NULL,
    "industry" TEXT,
    "status" "StockStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stocks_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "stock_profiles" (
    "symbol" TEXT NOT NULL,
    "company_name" TEXT,
    "established_date" TIMESTAMP(3),
    "capital" BIGINT,
    "chairman" TEXT,
    "ceo" TEXT,
    "main_products" TEXT,
    "website" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_profiles_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "daily_prices" (
    "symbol" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "open" DECIMAL(12,2) NOT NULL,
    "high" DECIMAL(12,2) NOT NULL,
    "low" DECIMAL(12,2) NOT NULL,
    "close" DECIMAL(12,2) NOT NULL,
    "volume" BIGINT NOT NULL,
    "turnover" BIGINT,
    "transaction_count" INTEGER,
    "change" DECIMAL(12,2),
    "change_percent" DECIMAL(8,4),

    CONSTRAINT "daily_prices_pkey" PRIMARY KEY ("symbol","date")
);

-- CreateTable
CREATE TABLE "monthly_revenues" (
    "symbol" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "revenue" BIGINT NOT NULL,
    "revenue_yoy" DECIMAL(10,4),
    "revenue_mom" DECIMAL(10,4),
    "cumulative_revenue" BIGINT,

    CONSTRAINT "monthly_revenues_pkey" PRIMARY KEY ("symbol","year","month")
);

-- CreateTable
CREATE TABLE "quarterly_financials" (
    "symbol" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "eps" DECIMAL(10,4),
    "gross_margin" DECIMAL(8,4),
    "operating_margin" DECIMAL(8,4),
    "net_margin" DECIMAL(8,4),
    "roe" DECIMAL(8,4),
    "roa" DECIMAL(8,4),
    "debt_ratio" DECIMAL(8,4),

    CONSTRAINT "quarterly_financials_pkey" PRIMARY KEY ("symbol","year","quarter")
);

-- CreateTable
CREATE TABLE "dividends" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "cash_dividend" DECIMAL(10,4),
    "stock_dividend" DECIMAL(10,4),
    "ex_dividend_date" DATE,

    CONSTRAINT "dividends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutional_trades_daily" (
    "symbol" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "foreign_buy" BIGINT NOT NULL,
    "foreign_sell" BIGINT NOT NULL,
    "foreign_net" BIGINT NOT NULL,
    "trust_buy" BIGINT NOT NULL,
    "trust_sell" BIGINT NOT NULL,
    "trust_net" BIGINT NOT NULL,
    "dealer_buy" BIGINT NOT NULL,
    "dealer_sell" BIGINT NOT NULL,
    "dealer_net" BIGINT NOT NULL,
    "total_net" BIGINT NOT NULL,

    CONSTRAINT "institutional_trades_daily_pkey" PRIMARY KEY ("symbol","date")
);

-- CreateTable
CREATE TABLE "margin_short_daily" (
    "symbol" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "margin_buy" BIGINT,
    "margin_sell" BIGINT,
    "margin_balance" BIGINT,
    "short_sell" BIGINT,
    "short_buy" BIGINT,
    "short_balance" BIGINT,

    CONSTRAINT "margin_short_daily_pkey" PRIMARY KEY ("symbol","date")
);

-- CreateTable
CREATE TABLE "technical_snapshots" (
    "symbol" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "ma5" DECIMAL(12,2),
    "ma10" DECIMAL(12,2),
    "ma20" DECIMAL(12,2),
    "ma60" DECIMAL(12,2),
    "ma120" DECIMAL(12,2),
    "ma240" DECIMAL(12,2),
    "rsi14" DECIMAL(8,4),
    "kd_k" DECIMAL(8,4),
    "kd_d" DECIMAL(8,4),
    "macd_dif" DECIMAL(12,4),
    "macd_dea" DECIMAL(12,4),
    "macd_hist" DECIMAL(12,4),
    "bias_5" DECIMAL(8,4),
    "bias_20" DECIMAL(8,4),

    CONSTRAINT "technical_snapshots_pkey" PRIMARY KEY ("symbol","date")
);

-- CreateTable
CREATE TABLE "score_snapshots" (
    "symbol" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "quality_score" DECIMAL(5,2),
    "timing_score" DECIMAL(5,2),
    "risk_score" DECIMAL(5,2),
    "composite_score" DECIMAL(5,2),
    "category" "RecommendationCategory",
    "analysis_json" JSONB,

    CONSTRAINT "score_snapshots_pkey" PRIMARY KEY ("symbol","date")
);

-- CreateTable
CREATE TABLE "recommendation_snapshots" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detail_json" JSONB,
    "support_price" DECIMAL(12,2),
    "resist_price" DECIMAL(12,2),
    "stop_loss" DECIMAL(12,2),

    CONSTRAINT "recommendation_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watchlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlist_items" (
    "id" TEXT NOT NULL,
    "watchlist_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "added_reason" TEXT,
    "note" TEXT,
    "tags" JSONB,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "condition_type" "AlertCondition" NOT NULL,
    "threshold" DECIMAL(12,4),
    "custom_config" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_events" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_channels" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationChannelType" NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_tested_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_delivery_attempts" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "channel_id" TEXT,
    "channel_type" "NotificationChannelType" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error_message" TEXT,
    "response_json" JSONB,

    CONSTRAINT "alert_delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_holdings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "shares" DECIMAL(14,4) NOT NULL,
    "average_cost" DECIMAL(12,4) NOT NULL,
    "target_price" DECIMAL(12,4),
    "stop_loss" DECIMAL(12,4),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_jobs" (
    "id" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "status" "IngestionStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "record_count" INTEGER,
    "error_message" TEXT,
    "metadata" JSONB,

    CONSTRAINT "ingestion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "daily_prices_date_idx" ON "daily_prices"("date");

-- CreateIndex
CREATE UNIQUE INDEX "dividends_symbol_year_key" ON "dividends"("symbol", "year");

-- CreateIndex
CREATE INDEX "institutional_trades_daily_date_idx" ON "institutional_trades_daily"("date");

-- CreateIndex
CREATE INDEX "technical_snapshots_date_idx" ON "technical_snapshots"("date");

-- CreateIndex
CREATE INDEX "score_snapshots_date_idx" ON "score_snapshots"("date");

-- CreateIndex
CREATE INDEX "score_snapshots_category_date_idx" ON "score_snapshots"("category", "date");

-- CreateIndex
CREATE INDEX "recommendation_snapshots_symbol_date_idx" ON "recommendation_snapshots"("symbol", "date");

-- CreateIndex
CREATE INDEX "recommendation_snapshots_date_idx" ON "recommendation_snapshots"("date");

-- CreateIndex
CREATE UNIQUE INDEX "watchlist_items_watchlist_id_symbol_key" ON "watchlist_items"("watchlist_id", "symbol");

-- CreateIndex
CREATE INDEX "alert_events_rule_id_triggered_at_idx" ON "alert_events"("rule_id", "triggered_at");

-- CreateIndex
CREATE INDEX "notification_channels_user_id_type_idx" ON "notification_channels"("user_id", "type");

-- CreateIndex
CREATE INDEX "alert_delivery_attempts_event_id_idx" ON "alert_delivery_attempts"("event_id");

-- CreateIndex
CREATE INDEX "alert_delivery_attempts_channel_id_idx" ON "alert_delivery_attempts"("channel_id");

-- CreateIndex
CREATE INDEX "portfolio_holdings_user_id_idx" ON "portfolio_holdings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_holdings_user_id_symbol_key" ON "portfolio_holdings"("user_id", "symbol");

-- CreateIndex
CREATE INDEX "ingestion_jobs_job_type_status_idx" ON "ingestion_jobs"("job_type", "status");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_profiles" ADD CONSTRAINT "stock_profiles_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_prices" ADD CONSTRAINT "daily_prices_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_revenues" ADD CONSTRAINT "monthly_revenues_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quarterly_financials" ADD CONSTRAINT "quarterly_financials_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividends" ADD CONSTRAINT "dividends_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutional_trades_daily" ADD CONSTRAINT "institutional_trades_daily_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "margin_short_daily" ADD CONSTRAINT "margin_short_daily_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_snapshots" ADD CONSTRAINT "technical_snapshots_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_snapshots" ADD CONSTRAINT "recommendation_snapshots_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_watchlist_id_fkey" FOREIGN KEY ("watchlist_id") REFERENCES "watchlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_channels" ADD CONSTRAINT "notification_channels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_delivery_attempts" ADD CONSTRAINT "alert_delivery_attempts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "alert_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_delivery_attempts" ADD CONSTRAINT "alert_delivery_attempts_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "notification_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_holdings" ADD CONSTRAINT "portfolio_holdings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_holdings" ADD CONSTRAINT "portfolio_holdings_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;
