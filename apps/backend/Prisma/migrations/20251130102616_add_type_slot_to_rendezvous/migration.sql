-- CreateEnum
CREATE TYPE "TypeSlot" AS ENUM ('hors', 'libre', 'pris', 'bloque');

-- AlterTable
ALTER TABLE "RendezVous" ADD COLUMN     "typeSlot" "TypeSlot" NOT NULL DEFAULT 'hors';
