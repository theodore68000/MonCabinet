-- AlterTable
ALTER TABLE "Medecin" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "nombreAvis" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "noteMoyenne" DOUBLE PRECISION DEFAULT 0;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "PatientFavori" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "medecinId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientFavori_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvisMedecin" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "medecinId" INTEGER NOT NULL,
    "note" DOUBLE PRECISION NOT NULL,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvisMedecin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatientFavori_patientId_medecinId_key" ON "PatientFavori"("patientId", "medecinId");

-- CreateIndex
CREATE UNIQUE INDEX "AvisMedecin_patientId_medecinId_key" ON "AvisMedecin"("patientId", "medecinId");

-- AddForeignKey
ALTER TABLE "PatientFavori" ADD CONSTRAINT "PatientFavori_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFavori" ADD CONSTRAINT "PatientFavori_medecinId_fkey" FOREIGN KEY ("medecinId") REFERENCES "Medecin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvisMedecin" ADD CONSTRAINT "AvisMedecin_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvisMedecin" ADD CONSTRAINT "AvisMedecin_medecinId_fkey" FOREIGN KEY ("medecinId") REFERENCES "Medecin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
