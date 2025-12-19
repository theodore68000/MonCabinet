import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";

type ActorRole = "patient" | "medecin" | "secretaire" | "system";

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  // ─────────────────────────────────────────
  // 🔧 Helpers
  // ─────────────────────────────────────────

  private async getRdvWithRelations(rdvId: number) {
    const rdv = await this.prisma.rendezVous.findUnique({
      where: { id: rdvId },
      include: {
        patient: true,
        proche: {
          include: { patient: true }, // proche.patient = patient parent
        },
        medecin: true,
      },
    });

    if (!rdv) {
      this.logger.warn(`RDV ${rdvId} introuvable pour notification`);
      return null;
    }

    return rdv;
  }

  private formatDateFr(date: Date) {
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  private formatHeure(h: string) {
    return h?.slice(0, 5) ?? "";
  }

  /**
   * 🔥 Règle A :
   * - si RDV pour patient -> email patient
   * - si RDV pour proche -> email du patient parent du proche
   * - sinon -> pas de mail
   */
  private getTargetPatient(rdv: any): { label: string; email: string | null } {
    // RDV directement pour un patient
    if (rdv.patient && rdv.patient.email) {
      return {
        label: `${rdv.patient.prenom} ${rdv.patient.nom}`,
        email: rdv.patient.email,
      };
    }

    // RDV pour un proche → on remonte au patient parent
    if (rdv.proche && rdv.proche.patient && rdv.proche.patient.email) {
      const p = rdv.proche.patient;
      return {
        label: `${p.prenom} ${p.nom} (parent du proche)`,
        email: p.email,
      };
    }

    return { label: "Patient inconnu", email: null };
  }

  private getTypeConsultationLabel(rdv: any): string {
    return rdv.typeConsultation === "VISIO" ? "en visio" : "au cabinet";
  }

  // ─────────────────────────────────────────
  // ✉️ CONFIRMATION DE RÉSERVATION
  // ─────────────────────────────────────────

  async notifyRdvConfirmation(rdvId: number, actor: ActorRole = "system") {
    const rdv = await this.getRdvWithRelations(rdvId);
    if (!rdv) return;

    const patientInfo = this.getTargetPatient(rdv);
    if (!patientInfo.email) {
      this.logger.warn(
        `Aucun email patient pour confirmation RDV ${rdvId}`,
      );
      return;
    }

    const dateStr = this.formatDateFr(rdv.date);
    const heureStr = this.formatHeure(rdv.heure);
    const typeStr = this.getTypeConsultationLabel(rdv);

    let subject = "";
    let intro = "";

    switch (actor) {
      case "patient":
        subject = "Confirmation de votre rendez-vous";
        intro = "Vous venez de prendre un rendez-vous.";
        break;
      case "medecin":
        subject = "Votre médecin a pris un rendez-vous pour vous";
        intro =
          "Votre médecin a créé un rendez-vous pour vous.";
        break;
      case "secretaire":
        subject = "Le cabinet a pris un rendez-vous pour vous";
        intro =
          "Le secrétariat du cabinet a créé un rendez-vous pour vous.";
        break;
      default:
        subject = "Votre rendez-vous a bien été enregistré";
        intro = "Un rendez-vous a été ajouté à votre dossier.";
    }

    const html = `
      <h2>${subject}</h2>
      <p>${intro}</p>
      <p>
        <strong>Médecin :</strong> Dr ${rdv.medecin?.prenom} ${rdv.medecin?.nom}<br/>
        <strong>Date :</strong> ${dateStr}<br/>
        <strong>Heure :</strong> ${heureStr}<br/>
        <strong>Type :</strong> ${typeStr}
      </p>
      ${rdv.motif ? `<p><strong>Motif :</strong> ${rdv.motif}</p>` : ""}
      <p>Vous pouvez gérer ce rendez-vous depuis votre espace patient.</p>
    `;

    await this.mailService.send(patientInfo.email, subject, html);
  }

  // ─────────────────────────────────────────
  // ✉️ MODIFICATION
  // (pas dans ta liste, mais on le garde utile)
  // ─────────────────────────────────────────

  async notifyRdvModification(rdvId: number, actor: ActorRole = "system") {
    const rdv = await this.getRdvWithRelations(rdvId);
    if (!rdv) return;

    const patientInfo = this.getTargetPatient(rdv);
    if (!patientInfo.email) {
      this.logger.warn(
        `Aucun email patient pour modification RDV ${rdvId}`,
      );
      return;
    }

    const dateStr = this.formatDateFr(rdv.date);
    const heureStr = this.formatHeure(rdv.heure);

    let subject = "Votre rendez-vous a été modifié";
    let intro = "";

    switch (actor) {
      case "patient":
        subject = "Vous avez modifié votre rendez-vous";
        intro = "Vous venez de modifier votre rendez-vous.";
        break;
      case "medecin":
        subject = "Votre médecin a modifié votre rendez-vous";
        intro = "Votre médecin a modifié la date ou l'horaire de votre rendez-vous.";
        break;
      case "secretaire":
        subject = "Le cabinet a modifié votre rendez-vous";
        intro =
          "Le secrétariat du cabinet a modifié votre rendez-vous.";
        break;
      default:
        intro = "Les informations de votre rendez-vous ont été mises à jour.";
    }

    const html = `
      <h2>${subject}</h2>
      <p>${intro}</p>
      <p>
        <strong>Médecin :</strong> Dr ${rdv.medecin?.prenom} ${rdv.medecin?.nom}<br/>
        <strong>Date :</strong> ${dateStr}<br/>
        <strong>Heure :</strong> ${heureStr}
      </p>
      ${rdv.motif ? `<p><strong>Motif :</strong> ${rdv.motif}</p>` : ""}
    `;

    await this.mailService.send(patientInfo.email, subject, html);
  }

  // ─────────────────────────────────────────
  // ✉️ ANNULATION
  // ─────────────────────────────────────────

  async notifyRdvAnnulation(rdvId: number, actor: ActorRole = "system") {
    const rdv = await this.getRdvWithRelations(rdvId);
    if (!rdv) return;

    const patientInfo = this.getTargetPatient(rdv);
    if (!patientInfo.email) {
      this.logger.warn(
        `Aucun email patient pour annulation RDV ${rdvId}`,
      );
      return;
    }

    const dateStr = this.formatDateFr(rdv.date);
    const heureStr = this.formatHeure(rdv.heure);

    let subject = "";
    let intro = "";

    switch (actor) {
      case "patient":
        subject = "Confirmation d'annulation de votre rendez-vous";
        intro = "Vous venez d'annuler votre rendez-vous.";
        break;
      case "medecin":
        subject = "Votre médecin a annulé votre rendez-vous";
        intro = "Votre médecin a annulé votre rendez-vous.";
        break;
      case "secretaire":
        subject = "Votre rendez-vous a été annulé par le cabinet";
        intro =
          "Le secrétariat du cabinet a annulé votre rendez-vous.";
        break;
      default:
        subject = "Votre rendez-vous a été annulé";
        intro = "Ce rendez-vous a été annulé.";
    }

    const html = `
      <h2>${subject}</h2>
      <p>${intro}</p>
      <p>
        <strong>Médecin :</strong> Dr ${rdv.medecin?.prenom} ${rdv.medecin?.nom}<br/>
        <strong>Date initiale :</strong> ${dateStr}<br/>
        <strong>Heure :</strong> ${heureStr}
      </p>
    `;

    await this.mailService.send(patientInfo.email, subject, html);
  }

  // ─────────────────────────────────────────
  // ⏰ Rappel ~24h avant (CRON)
  // ─────────────────────────────────────────

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sendRappels24h() {
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const rdvs = await this.prisma.rendezVous.findMany({
      where: {
        typeSlot: "PRIS",
        rappelEnvoye: false,
        date: { gte: now, lte: in48h },
        OR: [{ patientId: { not: null } }, { procheId: { not: null } }],
      },
      include: {
        patient: true,
        proche: { include: { patient: true } },
        medecin: true,
      },
    });

    for (const rdv of rdvs) {
      const rdvDateTime = new Date(rdv.date);
      const [h, m] = (rdv.heure || "00:00").split(":").map(Number);
      rdvDateTime.setHours(h || 0, m || 0, 0, 0);

      const diffMs = rdvDateTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      // On vise ~24h avant (entre 23.5h et 24.5h)
      if (diffHours > 23.5 && diffHours <= 24.5) {
        const patientInfo = this.getTargetPatient(rdv);
        if (!patientInfo.email) {
          this.logger.warn(
            `Aucun email patient pour rappel RDV ${rdv.id}`,
          );
          continue;
        }

        const dateStr = this.formatDateFr(rdv.date);
        const heureStr = this.formatHeure(rdv.heure);

        const subject = "Rappel de rendez-vous - J-1";
        const html = `
          <h2>Rappel de votre rendez-vous de demain</h2>
          <p>
            Bonjour,<br/>
            Ceci est un rappel pour votre rendez-vous prévu demain.
          </p>
          <p>
            <strong>Patient :</strong> ${patientInfo.label}<br/>
            <strong>Médecin :</strong> Dr ${rdv.medecin?.prenom} ${rdv.medecin?.nom}<br/>
            <strong>Date :</strong> ${dateStr}<br/>
            <strong>Heure :</strong> ${heureStr}
          </p>
        `;

        await this.mailService.send(patientInfo.email, subject, html);

        await this.prisma.rendezVous.update({
          where: { id: rdv.id },
          data: { rappelEnvoye: true },
        });

        this.logger.log(`Rappel 24h envoyé pour RDV ${rdv.id}`);
      }
    }
  }
}
