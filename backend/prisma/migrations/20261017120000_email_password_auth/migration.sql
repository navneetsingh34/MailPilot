-- AlterTable
ALTER TABLE "User" ALTER COLUMN "googleId" DROP NOT NULL,
ADD COLUMN     "passwordHash" TEXT;
