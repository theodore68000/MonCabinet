import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class FormulaireService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  /**
   * Création automatique d'un formulaire (idempotent)
   */
  async createForRdv(rdvId: number, patientId: number, medecinId: number) {
    const existing = await this.prisma.formulairePreconsultation.findUnique({
      where: { rdvId },
    });

    if (existing) return existing;

    return this.prisma.formulairePreconsultation.create({
      data: {
        rdvId,
        patientId,
        medecinId,
      },
    });
  }

  /**
   * Suppression du formulaire si le RDV est annulé
   */
  async deleteForRdv(rdvId: number) {
    return this.prisma.formulairePreconsultation
      .delete({
        where: { rdvId },
      })
      .catch(() => null);
  }

  /**
   * Envoie l’email contenant le lien vers le formulaire
   */
  async sendFormulaireEmail(to: string, rdvId: number) {
    const front = process.env.FRONT_URL || 'http://localhost:3000';
    const link = `${front}/patient/formulaire/${rdvId}`;

    const html = `
      <h2>Formulaire de pré-consultation</h2>
      <p>Merci de remplir votre formulaire avant votre rendez-vous.</p>
      <p>
        <a href="${link}" style="font-size:16px;color:#2563eb;font-weight:bold">
          Accéder au formulaire
        </a>
      </p>
    `;

    return this.mailService.send(
      to,
      'Formulaire de pré-consultation',
      html,
    );
  }

  /**
   * Lecture d'un formulaire
   */
  async getByRdvId(rdvId: number) {
    const form = await this.prisma.formulairePreconsultation.findUnique({
      where: { rdvId },
    });

    if (!form) throw new NotFoundException('Formulaire introuvable');
    return form;
  }

  /**
   * Patient remplit le formulaire
   */
  async updateFormulaire(rdvId: number, reponses: any) {
    const existing = await this.prisma.formulairePreconsultation.findUnique({
      where: { rdvId },
    });

    if (!existing) {
      throw new NotFoundException(
        "Formulaire introuvable pour ce rendez-vous.",
      );
    }

    return this.prisma.formulairePreconsultation.update({
      where: { rdvId },
      data: {
        reponses,
        rempli: true,
      },
    });
  }

  /**
   * CRON — rappels 24h avant
   * (la mise à jour rappelEnvoye se fera dans le cron runner)
   */
  async getFormsToRemind() {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    return this.prisma.formulairePreconsultation.findMany({
      where: {
        rempli: false,
        rdv: {
          date: {
            gte: now,
            lte: in24h,
          },
          rappelEnvoye: false,
        },
      },
      include: {
        rdv: true,
        patient: true,
      },
    });
  }
}
