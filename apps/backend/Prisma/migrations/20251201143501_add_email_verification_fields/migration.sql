-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verificationCode" TEXT,
ADD COLUMN     "verificationExpire" TIMESTAMP(3);
