// src/medecin/medecin.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedecinDto } from './dto/create-medecin.dto';
import { UpdateMedecinDto } from './dto/update-medecin.dto';
import { randomBytes } from 'crypto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class MedecinService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  create(data: CreateMedecinDto) {
    return this.prisma.medecin.create({
      data: {
        nom: data.nom,
        prenom: data.prenom,
        email: data.email,
        motDePasse: data.motDePasse ?? '1234',
        telephone: data.telephone,
        specialite: data.specialite,
        adresseCabinet: data.adresseCabinet,
        rpps: data.rpps,
        accepteNouveauxPatients: data.accepteNouveauxPatients ?? true,
        statut: data.statut ?? 'en_attente',
        photoUrl: data.photoUrl,
        horaires: data.horaires,
        bio: data.bio,
        typeExercice: data.typeExercice,
        siret: data.siret,
        adresseFacturation: data.adresseFacturation,
        cabinetId: data.cabinetId ?? null,
      },
    });
  }

  async login(email: string, motDePasse: string) {
    const medecin = await this.prisma.medecin.findUnique({
      where: { email },
    });

    if (!medecin) {
      return { success: false, message: "Aucun compte médecin n'est associé à cet email." };
    }

    if (medecin.motDePasse !== motDePasse) {
      return { success: false, message: 'Mot de passe incorrect.' };
    }

    return { success: true, message: 'Connexion réussie', medecin };
  }

  async forgotPassword(email: string) {
    const medecin = await this.prisma.medecin.findUnique({
      where: { email },
    });

    if (!medecin) {
      return { success: false, message: 'Aucun compte associé à cet email.' };
    }

    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 30);

    await this.prisma.medecin.update({
      where: { id: medecin.id },
      data: { resetToken: token, resetExpires: expires },
    });

    const resetLink = `${process.env.APP_URL}/medecin/reset-password/${token}`;

    await this.mailService.sendPasswordResetEmail(medecin.email, resetLink);

    return { success: true, message: 'Un email de réinitialisation a été envoyé.' };
  }

  async resetPassword(token: string, motDePasse: string) {
    const now = new Date();

    const medecin = await this.prisma.medecin.findFirst({
      where: {
        resetToken: token,
        resetExpires: { gt: now },
      },
    });

    if (!medecin) {
      return { success: false, message: 'Lien invalide ou expiré.' };
    }

    await this.prisma.medecin.update({
      where: { id: medecin.id },
      data: { motDePasse, resetToken: null, resetExpires: null },
    });

    return { success: true, message: 'Mot de passe réinitialisé avec succès.' };
  }

  findAll() {
    return this.prisma.medecin.findMany({
      include: { cabinet: true },
    });
  }

  findOne(id: number) {
    return this.prisma.medecin.findUnique({
      where: { id },
      include: { cabinet: true },
    });
  }

  async update(id: number, data: UpdateMedecinDto) {
    const safeData = { ...data };

    delete (safeData as any).nom;
    delete (safeData as any).prenom;
    delete (safeData as any).rpps;
    delete (safeData as any).cabinetId;
    delete (safeData as any).resetToken;
    delete (safeData as any).resetExpires;

    return this.prisma.medecin.update({
      where: { id },
      data: safeData,
    });
  }

  remove(id: number) {
    return this.prisma.medecin.delete({ where: { id } });
  }
}
