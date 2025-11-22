-- AlterTable
ALTER TABLE "Medecin" ADD COLUMN     "telephone" TEXT;

-- AlterTable
ALTER TABLE "Patient" ALTER COLUMN "telephone" DROP NOT NULL;

-- AlterTable
ALTER TABLE "RendezVous" ALTER COLUMN "statut" SET DEFAULT 'confirmé';
