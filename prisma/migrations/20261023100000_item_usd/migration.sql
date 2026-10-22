-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "costUsd" INTEGER,
ADD COLUMN     "priceUsd" INTEGER;


-- Past lines: USD price from the order's rate, cost from the option's current cost
UPDATE "OrderItem" i SET "priceUsd" = CASE WHEN o.currency = 'USD' THEN i."unitPrice" ELSE ROUND(i."unitPrice" / COALESCE(o."rateUsed", 130)) END
FROM "Order" o WHERE o.id = i."orderId" AND i."priceUsd" IS NULL;
UPDATE "OrderItem" i SET "costUsd" = v."costUsd" FROM "ProductVariant" v WHERE v.id = i."variantId" AND i."costUsd" IS NULL;
