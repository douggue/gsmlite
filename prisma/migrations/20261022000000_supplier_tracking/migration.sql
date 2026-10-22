-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "pausedBySupplier" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SupplierService" ADD COLUMN     "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "previousCredit" INTEGER,
ADD COLUMN     "priceChangedAt" TIMESTAMP(3);

