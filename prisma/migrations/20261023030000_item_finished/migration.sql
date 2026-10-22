-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "finishedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "OrderItem_variantId_finishedAt_idx" ON "OrderItem"("variantId", "finishedAt");


-- Existing finished lines: best known finish time
UPDATE "OrderItem" i SET "finishedAt" = COALESCE(i."refundedAt", o."fulfilledAt", o."updatedAt")
FROM "Order" o WHERE o.id = i."orderId" AND i.status <> 'PENDING' AND i."finishedAt" IS NULL;
