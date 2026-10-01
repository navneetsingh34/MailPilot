-- DropIndex
DROP INDEX "Email_userId_status_sentAt_idx";

-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "completedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Email_userId_status_completedAt_idx" ON "Email"("userId", "status", "completedAt");

-- Backfill rows that already finished
UPDATE "Email" SET "completedAt" = COALESCE("sentAt", "failedAt") WHERE "status" IN ('SENT', 'FAILED');
