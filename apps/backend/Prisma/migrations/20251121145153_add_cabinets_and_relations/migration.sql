-- AlterTable
ALTER TABLE "Medecin" ADD COLUMN     "cabinetId" INTEGER;

-- CreateTable
CREATE TABLE "Cabinet" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cabinet_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Medecin" ADD CONSTRAINT "Medecin_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "Cabinet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
