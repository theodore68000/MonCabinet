-- AlterTable
ALTER TABLE "RendezVous" ADD COLUMN     "procheId" INTEGER;

-- CreateTable
CREATE TABLE "Proche" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT,
    "anneeNaissance" INTEGER,
    "relation" TEXT NOT NULL,
    "notesSante" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proche_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_procheId_fkey" FOREIGN KEY ("procheId") REFERENCES "Proche"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proche" ADD CONSTRAINT "Proche_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
