-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "AiUsageKind" AS ENUM ('REPORT', 'FOLLOW_UP');

-- Retain the most recently created channel for each user/type before adding the unique constraint.
DELETE FROM "notification_channels" AS older
USING "notification_channels" AS newer
WHERE older."user_id" = newer."user_id"
  AND older."type" = newer."type"
  AND (
    older."created_at" < newer."created_at"
    OR (older."created_at" = newer."created_at" AND older."id" < newer."id")
  );

-- DropIndex
DROP INDEX "notification_channels_user_id_type_idx";

-- AlterTable
ALTER TABLE "alert_events" ADD COLUMN     "metadata" JSONB;

-- CreateTable
CREATE TABLE "ai_stock_analyses" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "source_date" DATE NOT NULL,
    "source_fingerprint" TEXT NOT NULL,
    "prompt_version" INTEGER NOT NULL DEFAULT 1,
    "content_json" JSONB NOT NULL,
    "usage_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_stock_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "analysis_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "usage_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "kind" "AiUsageKind" NOT NULL,
    "cache_hit" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_stock_analyses_symbol_provider_model_source_fingerprint__idx" ON "ai_stock_analyses"("symbol", "provider", "model", "source_fingerprint", "prompt_version", "created_at");

-- CreateIndex
CREATE INDEX "ai_conversations_user_id_symbol_last_active_at_idx" ON "ai_conversations"("user_id", "symbol", "last_active_at");

-- CreateIndex
CREATE INDEX "ai_messages_conversation_id_created_at_idx" ON "ai_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_events_user_id_created_at_idx" ON "ai_usage_events"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_channels_user_id_type_key" ON "notification_channels"("user_id", "type");

-- AddForeignKey
ALTER TABLE "ai_stock_analyses" ADD CONSTRAINT "ai_stock_analyses_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "ai_stock_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
