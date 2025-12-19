-- AlterTable
ALTER TABLE "Medecin" ADD COLUMN     "horairesReference" JSONB;

-- CreateTable
CREATE TABLE "HorairesExceptionnels" (
    "id" SERIAL NOT NULL,
    "medecinId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "horaires" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HorairesExceptionnels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HorairesExceptionnels_medecinId_date_idx" ON "HorairesExceptionnels"("medecinId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "HorairesExceptionnels_medecinId_date_key" ON "HorairesExceptionnels"("medecinId", "date");

-- AddForeignKey
ALTER TABLE "HorairesExceptionnels" ADD CONSTRAINT "HorairesExceptionnels_medecinId_fkey" FOREIGN KEY ("medecinId") REFERENCES "Medecin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
