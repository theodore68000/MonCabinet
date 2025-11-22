-- AlterTable
ALTER TABLE "Medecin" ADD COLUMN     "adresseFacturation" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "horaires" JSONB,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "siret" TEXT,
ADD COLUMN     "statut" TEXT NOT NULL DEFAULT 'en_attente',
ADD COLUMN     "typeExercice" TEXT;
