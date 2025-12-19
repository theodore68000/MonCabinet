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
   * CRON – Toutes les 30 minutes
   * Récupère les RDV dans les prochaines 24h
   * dont le formulaire n'est pas rempli
   * et dont le rappel n'a pas encore été envoyé
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

      // Marquer rappel comme envoyé
      await this.prisma.rendezVous.update({
        where: { id: form.rdvId },
        data: { rappelEnvoye: true },
      });

      this.logger.log(
        `✔ Rappel envoyé pour RDV ${form.rdvId} → ${form.patient.email}`,
      );
    }
  }
}
