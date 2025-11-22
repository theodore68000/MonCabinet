-- DropForeignKey
ALTER TABLE "public"."RendezVous" DROP CONSTRAINT "RendezVous_medecinId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RendezVous" DROP CONSTRAINT "RendezVous_patientId_fkey";

-- AlterTable
ALTER TABLE "RendezVous" ALTER COLUMN "medecinId" DROP NOT NULL,
ALTER COLUMN "patientId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_medecinId_fkey" FOREIGN KEY ("medecinId") REFERENCES "Medecin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
