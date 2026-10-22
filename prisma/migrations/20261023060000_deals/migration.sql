-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "priceUsd" INTEGER NOT NULL,
    "previousSale" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "announcedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deal_endedAt_endsAt_idx" ON "Deal"("endedAt", "endsAt");

