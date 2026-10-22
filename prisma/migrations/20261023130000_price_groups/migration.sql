-- AlterTable
ALTER TABLE "PriceGroup" ADD COLUMN     "autoRule" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "floorProfitUsd" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "minMonthlySpendUsd" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

