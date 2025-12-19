/*
  Warnings:

  - You are about to drop the column `latitude` on the `Medecin` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `Medecin` table. All the data in the column will be lost.
  - You are about to drop the column `nombreAvis` on the `Medecin` table. All the data in the column will be lost.
  - You are about to drop the column `noteMoyenne` on the `Medecin` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Medecin" DROP COLUMN "latitude",
DROP COLUMN "longitude",
DROP COLUMN "nombreAvis",
DROP COLUMN "noteMoyenne";
