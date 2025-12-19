-- CreateTable
CREATE TABLE "Secretaire" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "motDePasse" TEXT NOT NULL,
    "telephone" TEXT,
    "resetToken" TEXT,
    "resetExpires" TIMESTAMP(3),
    "cabinetId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Secretaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MedecinSecretaire" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_MedecinSecretaire_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Secretaire_email_key" ON "Secretaire"("email");

-- CreateIndex
CREATE INDEX "_MedecinSecretaire_B_index" ON "_MedecinSecretaire"("B");

-- AddForeignKey
ALTER TABLE "Secretaire" ADD CONSTRAINT "Secretaire_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "Cabinet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MedecinSecretaire" ADD CONSTRAINT "_MedecinSecretaire_A_fkey" FOREIGN KEY ("A") REFERENCES "Medecin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MedecinSecretaire" ADD CONSTRAINT "_MedecinSecretaire_B_fkey" FOREIGN KEY ("B") REFERENCES "Secretaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
