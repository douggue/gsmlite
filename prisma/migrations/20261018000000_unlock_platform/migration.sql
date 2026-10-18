-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('IMEI', 'SERVER', 'REMOTE');

-- CreateEnum
CREATE TYPE "SupplierOrderStatus" AS ENUM ('SUBMITTING', 'WAITING', 'IN_PROCESS', 'SUCCESS', 'REJECTED', 'UNKNOWN');

-- DropForeignKey
ALTER TABLE "SaleFeedItem" DROP CONSTRAINT "SaleFeedItem_productId_fkey";

-- DropIndex
DROP INDEX "Order_giftToken_key";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "giftToken",
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'WEB';

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "identifier" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "salesPopup",
ADD COLUMN     "allowBulk" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "identifierFormat" TEXT NOT NULL DEFAULT 'imei',
ADD COLUMN     "identifierLabel" JSONB,
ADD COLUMN     "serviceType" "ServiceType" NOT NULL DEFAULT 'IMEI';

-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "priceHtg",
DROP COLUMN "salePriceHtg",
ADD COLUMN     "costUsd" INTEGER,
ADD COLUMN     "maxQty" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "minQty" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "priceUsd" INTEGER NOT NULL,
ADD COLUMN     "salePriceUsd" INTEGER,
ADD COLUMN     "supplierId" TEXT,
ADD COLUMN     "supplierServiceId" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "priceGroupId" TEXT;

-- DropTable
DROP TABLE "SaleFeedItem";

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "paramFormat" TEXT NOT NULL DEFAULT 'xml',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "balance" INTEGER,
    "currency" TEXT,
    "lowBalanceAlert" INTEGER NOT NULL DEFAULT 0,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierService" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "remoteId" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ServiceType" NOT NULL,
    "credit" INTEGER NOT NULL,
    "time" TEXT,
    "info" TEXT,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierOrder" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "remoteRef" TEXT,
    "status" "SupplierOrderStatus" NOT NULL DEFAULT 'SUBMITTING',
    "result" TEXT,
    "error" TEXT,
    "checks" INTEGER NOT NULL DEFAULT 0,
    "nextCheckAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierLog" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "request" TEXT NOT NULL,
    "response" TEXT,
    "httpStatus" INTEGER,
    "ms" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discountBps" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupPrice" (
    "priceGroupId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "priceUsd" INTEGER NOT NULL,

    CONSTRAINT "GroupPrice_pkey" PRIMARY KEY ("priceGroupId","variantId")
);

-- CreateIndex
CREATE INDEX "SupplierService_supplierId_groupName_idx" ON "SupplierService"("supplierId", "groupName");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierService_supplierId_remoteId_key" ON "SupplierService"("supplierId", "remoteId");

-- CreateIndex
CREATE INDEX "SupplierOrder_status_nextCheckAt_idx" ON "SupplierOrder"("status", "nextCheckAt");

-- CreateIndex
CREATE INDEX "SupplierOrder_orderItemId_idx" ON "SupplierOrder"("orderItemId");

-- CreateIndex
CREATE INDEX "SupplierLog_supplierId_createdAt_idx" ON "SupplierLog"("supplierId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PriceGroup_name_key" ON "PriceGroup"("name");

-- CreateIndex
CREATE INDEX "OrderItem_identifier_idx" ON "OrderItem"("identifier");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_priceGroupId_fkey" FOREIGN KEY ("priceGroupId") REFERENCES "PriceGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierService" ADD CONSTRAINT "SupplierService_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOrder" ADD CONSTRAINT "SupplierOrder_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOrder" ADD CONSTRAINT "SupplierOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLog" ADD CONSTRAINT "SupplierLog_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPrice" ADD CONSTRAINT "GroupPrice_priceGroupId_fkey" FOREIGN KEY ("priceGroupId") REFERENCES "PriceGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPrice" ADD CONSTRAINT "GroupPrice_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Safety: an order line can have at most one supplier order that is not rejected, so a retry, a double click
-- or two cron runs can never send (and pay for) the same line twice.
CREATE UNIQUE INDEX "SupplierOrder_one_live_per_item" ON "SupplierOrder"("orderItemId") WHERE status <> 'REJECTED';
