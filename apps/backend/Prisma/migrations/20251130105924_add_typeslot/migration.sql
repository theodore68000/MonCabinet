/*
  Warnings:

  - You are about to drop the column `statut` on the `RendezVous` table. All the data in the column will be lost.
  - The `typeSlot` column on the `RendezVous` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "RendezVous" DROP COLUMN "statut",
DROP COLUMN "typeSlot",
ADD COLUMN     "typeSlot" TEXT NOT NULL DEFAULT 'HORS';

-- DropEnum
DROP TYPE "public"."TypeSlot";
