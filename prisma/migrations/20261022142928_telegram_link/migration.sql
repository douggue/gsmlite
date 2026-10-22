-- AlterTable
ALTER TABLE "user" ADD COLUMN     "telegramChatId" TEXT,
ADD COLUMN     "telegramLinkCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_telegramChatId_key" ON "user"("telegramChatId");

-- CreateIndex
CREATE UNIQUE INDEX "user_telegramLinkCode_key" ON "user"("telegramLinkCode");

