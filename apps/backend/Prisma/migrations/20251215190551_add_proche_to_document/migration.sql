/*
  Warnings:

  - You are about to drop the column `anneeNaissance` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `anneeNaissance` on the `Proche` table. All the data in the column will be lost.
  - The `typeSlot` column on the `RendezVous` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `dateNaissance` on table `Patient` required. This step will fail if there are existing NULL values in that column.
  - Made the column `dateNaissance` on table `Proche` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "TypeSlot" AS ENUM ('HORS', 'PRIS', 'LIBRE', 'BLOQUE');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "procheId" INTEGER;

-- AlterTable
ALTER TABLE "Patient" DROP COLUMN "anneeNaissance",
ALTER COLUMN "dateNaissance" SET NOT NULL;

-- AlterTable
ALTER TABLE "Proche" DROP COLUMN "anneeNaissance",
ALTER COLUMN "dateNaissance" SET NOT NULL;

-- AlterTable
ALTER TABLE "RendezVous" DROP COLUMN "typeSlot",
ADD COLUMN     "typeSlot" "TypeSlot" NOT NULL DEFAULT 'HORS';

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_procheId_fkey" FOREIGN KEY ("procheId") REFERENCES "Proche"("id") ON DELETE SET NULL ON UPDATE CASCADE;
