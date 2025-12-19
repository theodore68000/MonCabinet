-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_patientId_fkey";

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "filename" TEXT,
ALTER COLUMN "patientId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Document_patientId_idx" ON "Document"("patientId");

-- CreateIndex
CREATE INDEX "Document_procheId_idx" ON "Document"("procheId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
