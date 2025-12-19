-- AlterTable
ALTER TABLE "RendezVous" ADD COLUMN     "statutVisio" TEXT NOT NULL DEFAULT 'aucun',
ADD COLUMN     "typeConsultation" TEXT NOT NULL DEFAULT 'PRESENTIEL',
ADD COLUMN     "visioRoomName" TEXT;
