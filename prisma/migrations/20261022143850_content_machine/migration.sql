-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'REJECTED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "trafficSource" TEXT;

-- CreateTable
CREATE TABLE "ContentPage" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "slug" TEXT NOT NULL,
    "productId" TEXT,
    "brand" TEXT,
    "newsArticleId" TEXT,
    "keyword" TEXT NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{}',
    "dataHash" TEXT,
    "reason" TEXT,
    "costMicros" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "reviewedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "volume" INTEGER,
    "difficulty" INTEGER,
    "cpcCents" INTEGER,
    "intent" TEXT,
    "position" INTEGER,
    "clicks" INTEGER,
    "impressions" INTEGER,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idea',
    "score" INTEGER NOT NULL DEFAULT 0,
    "target" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentSpend" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "costMicros" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentSpend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentPage_slug_key" ON "ContentPage"("slug");

-- CreateIndex
CREATE INDEX "ContentPage_status_kind_idx" ON "ContentPage"("status", "kind");

-- CreateIndex
CREATE INDEX "ContentPage_productId_idx" ON "ContentPage"("productId");

-- CreateIndex
CREATE INDEX "Keyword_status_score_idx" ON "Keyword"("status", "score");

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_keyword_locale_country_key" ON "Keyword"("keyword", "locale", "country");

-- CreateIndex
CREATE INDEX "ContentSpend_createdAt_idx" ON "ContentSpend"("createdAt");

