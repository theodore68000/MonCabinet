-- CreateTable
CREATE TABLE "FormulairePreconsultation" (
    "id" SERIAL NOT NULL,
    "rdvId" INTEGER NOT NULL,
    "medecinId" INTEGER NOT NULL,
    "patientId" INTEGER NOT NULL,
    "reponses" JSONB,
    "rempli" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormulairePreconsultation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormulairePreconsultation_rdvId_key" ON "FormulairePreconsultation"("rdvId");

-- AddForeignKey
ALTER TABLE "FormulairePreconsultation" ADD CONSTRAINT "FormulairePreconsultation_rdvId_fkey" FOREIGN KEY ("rdvId") REFERENCES "RendezVous"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormulairePreconsultation" ADD CONSTRAINT "FormulairePreconsultation_medecinId_fkey" FOREIGN KEY ("medecinId") REFERENCES "Medecin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormulairePreconsultation" ADD CONSTRAINT "FormulairePreconsultation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
