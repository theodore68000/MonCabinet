-- AlterTable
ALTER TABLE "Medecin" ADD COLUMN     "resetExpires" TIMESTAMP(3),
ADD COLUMN     "resetToken" TEXT;
