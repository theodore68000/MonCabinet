-- AlterTable
ALTER TABLE "Medecin" ADD COLUMN     "accepteNouveauxPatients" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "adresseCabinet" TEXT,
ADD COLUMN     "rpps" TEXT;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_medecinTraitantId_fkey" FOREIGN KEY ("medecinTraitantId") REFERENCES "Medecin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
