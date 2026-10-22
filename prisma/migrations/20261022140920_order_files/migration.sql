-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "fieldsScrubbedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OrderFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderFile_userId_createdAt_idx" ON "OrderFile"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderFile_orderItemId_idx" ON "OrderFile"("orderItemId");

-- AddForeignKey
ALTER TABLE "OrderFile" ADD CONSTRAINT "OrderFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

