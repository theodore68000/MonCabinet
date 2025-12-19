/*
  Warnings:

  - A unique constraint covering the columns `[stripeAccountId]` on the table `Medecin` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PaiementStatus" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'SUCCES', 'ECHEC', 'REMBOURSE');

-- AlterTable
ALTER TABLE "Medecin" ADD COLUMN     "stripeAccountId" TEXT,
ADD COLUMN     "stripeOnboardingDone" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Paiement" (
    "id" SERIAL NOT NULL,
    "montantCents" INTEGER NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'eur',
    "status" "PaiementStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "stripePaymentIntentId" TEXT NOT NULL,
    "stripeChargeId" TEXT,
    "platformFeeCents" INTEGER NOT NULL DEFAULT 0,
    "patientId" INTEGER,
    "medecinId" INTEGER NOT NULL,
    "rendezVousId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Paiement_stripePaymentIntentId_key" ON "Paiement"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "Paiement_rendezVousId_key" ON "Paiement"("rendezVousId");

-- CreateIndex
CREATE UNIQUE INDEX "Medecin_stripeAccountId_key" ON "Medecin"("stripeAccountId");

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_medecinId_fkey" FOREIGN KEY ("medecinId") REFERENCES "Medecin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_rendezVousId_fkey" FOREIGN KEY ("rendezVousId") REFERENCES "RendezVous"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
