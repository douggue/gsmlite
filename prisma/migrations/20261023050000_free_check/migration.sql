-- CreateTable
CREATE TABLE "TacModel" (
    "tac" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TacModel_pkey" PRIMARY KEY ("tac")
);

-- CreateTable
CREATE TABLE "FreeCheck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT,
    "imei" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreeCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FreeCheck_userId_createdAt_idx" ON "FreeCheck"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FreeCheck_deviceId_createdAt_idx" ON "FreeCheck"("deviceId", "createdAt");

