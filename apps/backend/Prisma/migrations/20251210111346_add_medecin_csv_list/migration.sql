/*
  Warnings:

  - You are about to drop the column `medecinTraitantId` on the `Patient` table. All the data in the column will be lost.
  - Made the column `nom` on table `Proche` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_medecinTraitantId_fkey";

-- AlterTable
ALTER TABLE "Patient" DROP COLUMN "medecinTraitantId",
ADD COLUMN     "dateNaissance" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Proche" ADD COLUMN     "dateNaissance" TIMESTAMP(3),
ALTER COLUMN "nom" SET NOT NULL;

-- CreateTable
CREATE TABLE "MedecinPatientCSV" (
    "id" SERIAL NOT NULL,
    "medecinId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "dateNaissance" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedecinPatientCSV_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MedecinPatientCSV_medecinId_idx" ON "MedecinPatientCSV"("medecinId");

-- CreateIndex
CREATE INDEX "MedecinPatientCSV_nom_prenom_dateNaissance_idx" ON "MedecinPatientCSV"("nom", "prenom", "dateNaissance");

-- CreateIndex
CREATE INDEX "Patient_nom_prenom_dateNaissance_idx" ON "Patient"("nom", "prenom", "dateNaissance");

-- CreateIndex
CREATE INDEX "Proche_nom_prenom_dateNaissance_idx" ON "Proche"("nom", "prenom", "dateNaissance");

-- AddForeignKey
ALTER TABLE "MedecinPatientCSV" ADD CONSTRAINT "MedecinPatientCSV_medecinId_fkey" FOREIGN KEY ("medecinId") REFERENCES "Medecin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
