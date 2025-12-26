import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { FormulaireService } from '../formulaire/formulaire.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private prisma: PrismaService,
    private formulaireService: FormulaireService,
  ) {}

  /**
   * ⏳ CRON – Toutes les 30 minutes
   * Envoie un rappel aux patients dont le RDV est dans les 24h,
   * dont le formulaire n’est pas rempli,
   * et pour lesquels aucun rappel n’a encore été envoyé.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async remindFormulaire() {
    this.logger.log('⏳ Vérification des formulaires non remplis…');

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const toRemind = await this.prisma.formulairePreconsultation.findMany({
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
        patient: true,
        rdv: true,
      },
    });

    if (toRemind.length === 0) {
      this.logger.log('Aucun rappel à envoyer.');
      return;
    }

    this.logger.log(`📩 ${toRemind.length} rappels à envoyer.`);

    for (const form of toRemind) {
      if (!form.patient?.email) continue;

      await this.formulaireService.sendFormulaireEmail(
        form.patient.email,
        form.rdvId,
      );

      // Marquer le rappel comme envoyé sur le RDV
      await this.prisma.rendezVous.update({
        where: { id: form.rdvId },
        data: { rappelEnvoye: true },
      });

      this.logger.log(
        `✔ Rappel envoyé pour RDV ${form.rdvId} → ${form.patient.email}`,
      );
    }
  }

  /**
   * 🧹 CRON – Tous les jours à 01:00
   * Supprime les formulaires de pré-consultation
   * dont le RDV est passé (la veille ou avant).
   *
   * ➜ Conformité RGPD / nettoyage automatique
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async cleanupExpiredFormulaires() {
    this.logger.log('🧹 Nettoyage des formulaires expirés…');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result =
      await this.formulaireService.deleteExpiredFormulaires();

    if (result.count === 0) {
      this.logger.log('Aucun formulaire à supprimer.');
      return;
    }

    this.logger.log(
      `🗑️ ${result.count} formulaires supprimés (RDV passés)`,
    );
  }
}
