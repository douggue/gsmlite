-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "instructions" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "packSize" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "SupplierService" ADD COLUMN     "creditMicros" INTEGER NOT NULL DEFAULT 0;

UPDATE "SupplierService" SET "creditMicros" = "credit" * 10000;
