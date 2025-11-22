/*
  Warnings:

  - You are about to drop the column `createdAt` on the `RendezVous` table. All the data in the column will be lost.
  - You are about to drop the column `motif` on the `RendezVous` table. All the data in the column will be lost.
  - Added the required column `motDePasse` to the `Medecin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Medecin` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Medecin" ADD COLUMN     "motDePasse" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "resetExpires" TIMESTAMP(3),
ADD COLUMN     "resetToken" TEXT;

-- AlterTable
ALTER TABLE "RendezVous" DROP COLUMN "createdAt",
DROP COLUMN "motif",
ALTER COLUMN "statut" DROP DEFAULT;
