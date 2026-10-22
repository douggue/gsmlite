-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "kycLevelKey" TEXT,
ADD COLUMN     "offerCheck" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "seoPage" BOOLEAN NOT NULL DEFAULT true;

