import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class PatientService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  // CREATE
  create(data: CreatePatientDto) {
    return this.prisma.patient.create({
      data: {
        nom: data.nom,
        prenom: data.prenom,
        email: data.email,
        motDePasse: data.motDePasse ?? '1234',
        telephone: data.telephone,
        adresse: data.adresse,
        anneeNaissance: data.anneeNaissance,
        medecinTraitantId: data.medecinTraitantId,
      },
      include: { medecinTraitant: true },
    });
  }

  // LOGIN
  async login(email: string, motDePasse: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { email },
      include: { medecinTraitant: true },
    });

    if (!patient) return { message: 'Email introuvable' };
    if (patient.motDePasse !== motDePasse) {
      return { message: 'Mot de passe incorrect' };
    }

    return {
      id: patient.id,
      nom: patient.nom,
      prenom: patient.prenom,
      email: patient.email,
      telephone: patient.telephone,
      adresse: patient.adresse,
      anneeNaissance: patient.anneeNaissance,
      medecinTraitantId: patient.medecinTraitantId,
      medecinTraitant: patient.medecinTraitant,
    };
  }

  // 🔐 MOT DE PASSE OUBLIÉ : génère token + enregistre en BDD + envoie mail
  async forgotPassword(email: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { email },
    });

    if (!patient) {
      return {
        success: false,
        message: "Aucun compte n'existe avec cet email.",
      };
    }

    // Génération d’un token simple et d’une expiration (1h)
    const resetToken =
      Math.random().toString(36).substring(2) +
      Date.now().toString(36);
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    // Sauvegarde en base
    await this.prisma.patient.update({
      where: { id: patient.id },
      data: {
        resetToken,
        resetExpires,
      },
    });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const resetLink = `${appUrl}/patient/reset-password?token=${resetToken}`;

    // Envoi réel de l’email
    await this.mailService.sendPasswordResetEmail(email, resetLink);

    return {
      success: true,
      message: 'Un email de réinitialisation de mot de passe a été envoyé.',
    };
  }

  // 🔄 RÉINITIALISATION DU MOT DE PASSE AVEC TOKEN
  async resetPassword(token: string, motDePasse: string) {
    const now = new Date();

    const patient = await this.prisma.patient.findFirst({
      where: {
        resetToken: token,
        resetExpires: {
          gt: now, // token encore valide
        },
      },
    });

    if (!patient) {
      return {
        success: false,
        message: 'Lien invalide ou expiré.',
      };
    }

    await this.prisma.patient.update({
      where: { id: patient.id },
      data: {
        motDePasse,
        resetToken: null,
        resetExpires: null,
      },
    });

    return {
      success: true,
      message: 'Mot de passe réinitialisé avec succès.',
    };
  }

  // FIND ALL
  findAll() {
    return this.prisma.patient.findMany({
      include: { medecinTraitant: true },
    });
  }

  // FIND ONE
  findOne(id: number) {
    return this.prisma.patient.findUnique({
      where: { id },
      include: { medecinTraitant: true },
    });
  }

  // UPDATE
  update(id: number, data: UpdatePatientDto) {
    return this.prisma.patient.update({
      where: { id },
      data,
      include: { medecinTraitant: true },
    });
  }

  // DELETE
  remove(id: number) {
    return this.prisma.patient.delete({
      where: { id },
    });
  }
}
