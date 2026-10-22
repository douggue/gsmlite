-- CreateEnum
CREATE TYPE "ServiceChangeKind" AS ENUM ('NEW', 'PRICE_DOWN', 'PRICE_UP', 'REMOVED', 'BACK');

-- CreateTable
CREATE TABLE "ServiceChange" (
    "id" TEXT NOT NULL,
    "kind" "ServiceChangeKind" NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "oldPrice" INTEGER,
    "newPrice" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceChange_createdAt_idx" ON "ServiceChange"("createdAt");

-- CreateIndex
CREATE INDEX "ServiceChange_productId_createdAt_idx" ON "ServiceChange"("productId", "createdAt");

