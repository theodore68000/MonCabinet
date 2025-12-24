import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateRdvDto } from './dto/create-rdv.dto';
import { UpdateRdvDto } from './dto/update-rdv.dto';
import { NotificationService } from 'src/notification/notification.service';
import { FormulaireService } from 'src/formulaire/formulaire.service';
import { Prisma } from '@prisma/client';



/**
 * Règles métier stabilisées :
 * - typeSlot en MAJ UNIQUEMENT : LIBRE | PRIS | BLOQUE | HORS
 * - patient/proche XOR (jamais les deux)
 * - patient : 1 seul RDV futur PRIS par médecin
 * - médecin : pas de limitation
 * - si medecin n'accepte pas nouveaux patients -> CSV gate (patient ou identité du proche)
 *
 * AJOUT (front médecin) :
 * - patientIdentity.source === 'CSV' => matching strict CSV (nom+prenom+date JJ/MM/AAAA) TOUJOURS
 * - patientIdentity.source === 'HORS' => aucun contrôle
 */
@Injectable()
export class RdvService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private formulaireService: FormulaireService,
  ) {}

  /* -------------------------------------------------------------
   * Utils
   ------------------------------------------------------------- */

  private normalize(v: string): string {
    return (v ?? '')
      .toString()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  /**
   * FIX: comparaison date-only en UTC pour éviter les décalages de fuseau.
   */
  private sameDateUTC(a: Date, b: Date): boolean {
    if (!a || !b) return false;
    return (
      a.getUTCFullYear() === b.getUTCFullYear() &&
      a.getUTCMonth() === b.getUTCMonth() &&
      a.getUTCDate() === b.getUTCDate()
    );
  }

  /**
   * Parse date FR JJ/MM/AAAA vers Date en UTC (minuit UTC).
   */
  private parseBirthDateFRToUTC(v?: string): Date | null {
    if (!v) return null;
    const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const [, dd, mm, yyyy] = m;
    const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * Prisma enum TypeSlot attendu côté DB
   */
  private normalizeTypeSlot(slot: any): 'LIBRE' | 'PRIS' | 'BLOQUE' | 'HORS' {
    const raw = (slot ?? '').toString().trim();
    if (!raw) return 'HORS';
    const up = raw.toUpperCase();

    if (up === 'LIBRE' || up === 'PRIS' || up === 'BLOQUE' || up === 'HORS') {
      return up as any;
    }

    // fallback sûr
    return 'HORS';
  }


  private normalizeBirthDate(value: any): string | null {
  if (!value) return null;

  const s = value.toString().trim();

  // YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // DD/MM/YYYY (CSV)
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  // YYYY/MM/DD
  m = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  return null;
}

  private normalizeConsultationType(t: any): 'PRESENTIEL' | 'VISIO' {
    const raw = (t ?? '').toString().trim().toUpperCase();
    return raw === 'VISIO' ? 'VISIO' : 'PRESENTIEL';
  }

  private async assertPatientExists(patientId: number | null): Promise<void> {
    if (!patientId) return;
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true },
    });
    if (!patient) throw new NotFoundException('Patient introuvable.');
  }


  private async resolveProcheFromIdentity(
  ownerPatientId: number,
  identity: {
    nom?: string;
    prenom?: string;
    dateNaissance?: string | null;
  },
): Promise<number | null> {
  if (!identity?.nom || !identity?.prenom) return null;

  const proches = await this.prisma.proche.findMany({
    where: { patientId: ownerPatientId },
    select: {
      id: true,
      nom: true,
      prenom: true,
      dateNaissance: true,
    },
  });

  const normalize = (v?: string) =>
    (v ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const normalizeDate = (v?: string | null) => {
    if (!v) return null;
    const s = v.toString().trim();

    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;

    m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;

    return null;
  };

  const idNom = normalize(identity.nom);
  const idPrenom = normalize(identity.prenom);
  const idDate = normalizeDate(identity.dateNaissance);

  const found = proches.find((p) => {
    if (
      normalize(p.nom) !== idNom ||
      normalize(p.prenom) !== idPrenom
    ) {
      return false;
    }

    if (idDate && p.dateNaissance) {
      return normalizeDate(p.dateNaissance) === idDate;
    }

    return true;
  });

  return found?.id ?? null;
}

private async getIdentityForBooking(
  patientId: number | null,
  procheId: number | null,
): Promise<{ nom: string; prenom: string; dateNaissance: string }> {
  if (procheId) {
    const proche = await this.prisma.proche.findUnique({
      where: { id: procheId },
      select: {
        nom: true,
        prenom: true,
        dateNaissance: true,
      },
    });

    if (!proche) {
      throw new NotFoundException('Proche introuvable.');
    }

    return {
      nom: proche.nom,
      prenom: proche.prenom,
      dateNaissance: (proche.dateNaissance ?? '').toString().trim(),
    };
  }

  if (patientId) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        nom: true,
        prenom: true,
        dateNaissance: true,
      },
    });

    if (!patient) {
      throw new NotFoundException('Patient introuvable.');
    }

    return {
      nom: patient.nom,
      prenom: patient.prenom,
      dateNaissance: (patient.dateNaissance ?? '').toString().trim(),
    };
  }

  throw new BadRequestException('Patient ou proche obligatoire.');
}

private async swapInternal(firstId: number, secondId: number) {
  // ───────────────────────────────────────────
  // Guards de base
  // ───────────────────────────────────────────
  if (firstId === secondId) {
    throw new BadRequestException(
      'Impossible de swap un RDV avec lui-même.',
    );
  }

  // ───────────────────────────────────────────
  // Chargement des deux RDV
  // ───────────────────────────────────────────
  const [a, b] = await this.prisma.$transaction([
    this.prisma.rendezVous.findUnique({ where: { id: firstId } }),
    this.prisma.rendezVous.findUnique({ where: { id: secondId } }),
  ]);

  if (!a || !b) {
    throw new NotFoundException('RDV introuvable.');
  }

  // ───────────────────────────────────────────
  // 🔁 SWAP COMPLET ET COHÉRENT
  // (obligatoire pour vue cabinet inter-médecins)
  // ───────────────────────────────────────────
  await this.prisma.$transaction([
    this.prisma.rendezVous.update({
      where: { id: a.id },
      data: {
        // position
        date: b.date,
        heure: b.heure,
        medecinId: b.medecinId, // ✅ CRITIQUE

        // contenu
        patientId: b.patientId,
        procheId: b.procheId,
        patientIdentity: b.patientIdentity as Prisma.InputJsonValue,
        motif: b.motif,

        // état
        typeSlot: b.typeSlot,
        typeConsultation: b.typeConsultation,
      },
    }),
    this.prisma.rendezVous.update({
      where: { id: b.id },
      data: {
        // position
        date: a.date,
        heure: a.heure,
        medecinId: a.medecinId, // ✅ CRITIQUE

        // contenu
        patientId: a.patientId,
        procheId: a.procheId,
        patientIdentity: a.patientIdentity as Prisma.InputJsonValue,
        motif: a.motif,

        // état
        typeSlot: a.typeSlot,
        typeConsultation: a.typeConsultation,
      },
    }),
  ]);

  return { success: true };
}



private generateDaySlots(
  start = '07:00',
  end = '23:00',
  stepMinutes = 15,
): string[] {
  const res: string[] = [];

  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);

  let cur = sh * 60 + sm;
  const endMin = eh * 60 + em;

  while (cur < endMin) {
    const h = String(Math.floor(cur / 60)).padStart(2, '0');
    const m = String(cur % 60).padStart(2, '0');
    res.push(`${h}:${m}`);
    cur += stepMinutes;
  }

  return res;
}

private getDayBoundsUTC(base: Date) {
  const ymd = base.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const dayStartUTC = new Date(`${ymd}T00:00:00.000Z`);
  const dayEndUTC = new Date(`${ymd}T23:59:59.999Z`);
  return { dayStartUTC, dayEndUTC };
}


private isInHoraires(
  heure: string,
  horaires: Array<{ start: string; end: string }>,
): boolean {
  const [h, m] = heure.split(':').map(Number);
  const minutes = h * 60 + m;

  return horaires.some((h) => {
    const [sh, sm] = h.start.split(':').map(Number);
    const [eh, em] = h.end.split(':').map(Number);
    return minutes >= sh * 60 + sm && minutes < eh * 60 + em;
  });
}


  /**
   * CSV gate : si le médecin n'accepte pas de nouveaux patients,
   * on vérifie l'identité du patient/proche dans medecinPatientCSV.
   */
private async assertPatientAllowedForMedecin(
  medecinId: number,
  identity: { nom: string; prenom: string; dateNaissance: string },
): Promise<void> {
  const medecin = await this.prisma.medecin.findUnique({
    where: { id: medecinId },
    select: {
      accepteNouveauxPatients: true,
    },
  });

  if (!medecin) {
    throw new NotFoundException('Médecin introuvable.');
  }

  // Si le médecin accepte les nouveaux patients → OK
  if (medecin.accepteNouveauxPatients === true) {
    return;
  }

  const rows = await this.prisma.medecinPatientCSV.findMany({
    where: { medecinId },
    select: {
      nom: true,
      prenom: true,
      dateNaissance: true,
    },
  });

  if (!rows.length) {
    throw new ForbiddenException(
      "Ce médecin n'accepte pas de nouveaux patients.",
    );
  }

  const normalize = (v: string) =>
    v
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

  const normalizeDate = (v: string): string | null => {
    if (!v) return null;
    const s = v.trim();

    // YYYY-MM-DD
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;

    // DD/MM/YYYY
    m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;

    // YYYY/MM/DD
    m = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;

    return null;
  };

  const idNom = normalize(identity.nom);
  const idPrenom = normalize(identity.prenom);
  const idDate = normalizeDate(identity.dateNaissance);

  if (!idDate) {
    throw new ForbiddenException(
      "Date de naissance invalide pour la vérification patient.",
    );
  }

  const allowed = rows.some((row) => {
    return (
      normalize(row.nom) === idNom &&
      normalize(row.prenom) === idPrenom &&
      normalizeDate(row.dateNaissance) === idDate
    );
  });

  if (!allowed) {
    throw new ForbiddenException(
      "Ce médecin n'accepte pas de nouveaux patients.",
    );
  }
}

private rdvMatchesPatientIdentity(
  rdv: any,
  patient: { id: number; nom: string; prenom: string; dateNaissance: string },
): boolean {
  // 1️⃣ lien direct
  if (rdv.patientId === patient.id) return true;

  // 2️⃣ via proche
  if (rdv.proche && rdv.proche.patientId === patient.id) return true;

  // 3️⃣ via identité JSON (COMME LE FRONT)
  if (rdv.patientIdentity) {
    return (
      this.normalize(rdv.patientIdentity.nom) ===
        this.normalize(patient.nom) &&
      this.normalize(rdv.patientIdentity.prenom) ===
        this.normalize(patient.prenom)
    );
  }

  return false;
}


async patientHasFutureRdvWithMedecin(
  patientId: number,
  medecinId: number,
): Promise<boolean> {
  const now = new Date();

  const patient = await this.prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      nom: true,
      prenom: true,
      dateNaissance: true,
    },
  });
  if (!patient) return false;

  const rdvs = await this.prisma.rendezVous.findMany({
    where: {
      medecinId,
      typeSlot: 'PRIS',
    },
    include: {
      proche: true,
    },
  });

  for (const rdv of rdvs) {
    const full = new Date(rdv.date);
    const [h, m] = rdv.heure.split(':').map(Number);
    full.setHours(h, m, 0, 0);

    if (full < now) continue;

    if (this.rdvMatchesPatientIdentity(rdv, patient)) {
      return true;
    }
  }

  return false;
}


async procheHasFutureRdvWithMedecin(
  procheId: number,
  medecinId: number,
): Promise<boolean> {
  const now = new Date();

  // 🔒 sécurité proche
  const proche = await this.prisma.proche.findUnique({
    where: { id: procheId },
    select: {
      id: true,
      nom: true,
      prenom: true,
      patientId: true,
    },
  });

  if (!proche) return false;

  // 🔑 date du jour (minuit)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 🔥 FILTRAGE DB STRICT (CRITIQUE)
  const rdvs = await this.prisma.rendezVous.findMany({
    where: {
      medecinId,
      typeSlot: 'PRIS',
      date: { gte: today }, // ⬅️ LE FIX MAJEUR
    },
    include: {
      proche: true,
    },
  });

  for (const rdv of rdvs) {
    // 🛡️ garde absolue
    if (!rdv.date || !rdv.heure) continue;

    const [h, m] = rdv.heure.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) continue;

    const full = new Date(rdv.date);
    full.setHours(h, m, 0, 0);

    if (full < now) continue;

    // 1️⃣ lien direct proche
    if (rdv.procheId === proche.id) {
      return true;
    }

    // 2️⃣ via patient propriétaire
    if (rdv.proche && rdv.proche.patientId === proche.patientId) {
      return true;
    }

    // 3️⃣ via identité JSON (CSV / secrétaire / historique)
    const identity = rdv.patientIdentity as
      | { nom?: string; prenom?: string }
      | null;

    if (
      identity?.nom &&
      identity?.prenom &&
      this.normalize(identity.nom) === this.normalize(proche.nom) &&
      this.normalize(identity.prenom) === this.normalize(proche.prenom)
    ) {
      return true;
    }
  }

  return false;
}


private async assertIdentityInCsvForMedecin(
  medecinId: number,
  identity: {
    nom: string;
    prenom: string;
    dateNaissance: string;
  },
): Promise<void> {
  const rows = await this.prisma.medecinPatientCSV.findMany({
    where: { medecinId },
    select: {
      nom: true,
      prenom: true,
      dateNaissance: true,
    },
  });

  if (!rows.length) {
    throw new BadRequestException(
      "Aucune base CSV trouvée pour ce médecin.",
    );
  }

  const normalizeText = (v: string) =>
    v
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const normalizeDate = (v: any): string | null => {
    if (!v) return null;
    const s = v.toString().trim();

    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;

    m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;

    m = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;

    return null;
  };

  const idNom = normalizeText(identity.nom);
  const idPrenom = normalizeText(identity.prenom);
  const idDate = normalizeDate(identity.dateNaissance);

  if (!idDate) {
    throw new BadRequestException('Date de naissance invalide.');
  }

  const found = rows.some(
    (r) =>
      normalizeText(r.nom) === idNom &&
      normalizeText(r.prenom) === idPrenom &&
      normalizeDate(r.dateNaissance) === idDate,
  );

  if (!found) {
    throw new BadRequestException(
      "L'identité ne correspond pas strictement au CSV du médecin.",
    );
  }
}

private splitInterval(start: string, end: string): string[] {
  const res: string[] = [];
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);

  let cur = sh * 60 + sm;
  const endMin = eh * 60 + em;

  while (cur < endMin) {
    const h = String(Math.floor(cur / 60)).padStart(2, '0');
    const m = String(cur % 60).padStart(2, '0');
    res.push(`${h}:${m}`);
    cur += 15;
  }

  return res;
}


  /**
   * AJOUT: matching strict CSV (indépendant de accepteNouveauxPatients)
   * Utilisé UNIQUEMENT quand le front médecin force source=CSV.
   */
private assertStrictCsvMatch(
  medecinId: number,
  data: {
    csvRows: Array<{
      nom: string;
      prenom: string;
      dateNaissance: any;
    }>;
    parsedRows: Array<{
      nom: string;
      prenom: string;
      dateNaissance: any;
    }>;
  },
): void {
  const { csvRows, parsedRows } = data;

  const normalizeText = (v: string) =>
    v
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const normalizeBirthDate = (v: any): string | null => {
    if (!v) return null;
    const s = v.toString().trim();

    // YYYY-MM-DD
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;

    // DD/MM/YYYY
    m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;

    // YYYY/MM/DD
    m = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;

    return null;
  };

  const normalizedParsed = parsedRows.map((p) => ({
    nom: normalizeText(p.nom),
    prenom: normalizeText(p.prenom),
    dateNaissance: normalizeBirthDate(p.dateNaissance),
  }));

  for (const row of csvRows) {
    const rowNom = normalizeText(row.nom);
    const rowPrenom = normalizeText(row.prenom);
    const rowDate = normalizeBirthDate(row.dateNaissance);

    const found = normalizedParsed.some(
      (p) =>
        p.nom === rowNom &&
        p.prenom === rowPrenom &&
        p.dateNaissance === rowDate,
    );

    if (!found) {
      throw new BadRequestException(
        "Le fichier CSV ne correspond pas strictement à la base existante.",
      );
    }
  }
}


  /**
   * ✅ NEW — transition métier typeSlot (médecin + secrétaire)
   * Objectif: permettre de passer d'un type à n'importe quel autre,
   * tout en gardant une base cohérente.
   */
  private buildTransitionPatch(
    before: any,
    dto: UpdateRdvDto,
  ): {
    dataPatch: any;
    nextTypeSlot?: 'LIBRE' | 'PRIS' | 'BLOQUE' | 'HORS';
  } {
    const nextTypeSlot =
      dto.typeSlot !== undefined ? this.normalizeTypeSlot(dto.typeSlot) : undefined;

    const nextPatientId =
      dto.patientId !== undefined
        ? dto.patientId === null
          ? null
          : Number(dto.patientId)
        : undefined;

    const nextProcheId =
      dto.procheId !== undefined
        ? dto.procheId === null
          ? null
          : Number(dto.procheId)
        : undefined;

    // XOR strict (si les 2 sont explicitement non-null côté dto)
    if (
      nextPatientId !== undefined &&
      nextPatientId !== null &&
      nextProcheId !== undefined &&
      nextProcheId !== null
    ) {
      throw new BadRequestException(
        'Un RDV ne peut pas être pour un patient ET un proche.',
      );
    }

    const dataPatch: any = {
      motif: dto.motif !== undefined ? dto.motif : undefined,
      patientId: nextPatientId,
      procheId: nextProcheId,
      medecinId: dto.medecinId !== undefined ? Number(dto.medecinId) : undefined,
      typeSlot: nextTypeSlot,
      typeConsultation:
        dto.typeConsultation !== undefined
          ? this.normalizeConsultationType(dto.typeConsultation)
          : undefined,
    };

    // Transition: si on sort de PRIS => on nettoie systématiquement (cohérence DB)
    if (nextTypeSlot !== undefined && nextTypeSlot !== 'PRIS') {
      dataPatch.patientId = null;
      dataPatch.procheId = null;
      dataPatch.motif = null;
    }

    // Transition: si on passe en PRIS => patient ou proche obligatoire (ou déjà présent)
    if (nextTypeSlot !== undefined && nextTypeSlot === 'PRIS') {
      const afterPatientId =
        dataPatch.patientId !== undefined ? dataPatch.patientId : before.patientId;
      const afterProcheId =
        dataPatch.procheId !== undefined ? dataPatch.procheId : before.procheId;

      if (!afterPatientId && !afterProcheId) {
        throw new BadRequestException(
          'Pour passer un créneau en PRIS, patientId ou procheId est obligatoire.',
        );
      }
    }

    return { dataPatch, nextTypeSlot };
  }

  /* -------------------------------------------------------------
   * CRUD / Queries
   ------------------------------------------------------------- */

  async getSlotsForMedecin(medecinId: number) {
    return this.prisma.rendezVous.findMany({
      where: { medecinId },
    });
  }
  

async update(
  rdvId: number,
  dto: UpdateRdvDto,
  actor: 'medecin' | 'secretaire' = 'medecin',
) {
  const rdv = await this.prisma.rendezVous.findUnique({
    where: { id: rdvId },
  });

  if (!rdv) {
    throw new NotFoundException('RDV introuvable.');
  }

  const { dataPatch, nextTypeSlot } = this.buildTransitionPatch(rdv, dto);

  // 🔒 Gestion formulaire (médecin / secrétaire UNIQUEMENT)
  if (dto.formulaireDemande !== undefined) {
    dataPatch.formulaireDemande = dto.formulaireDemande;
  }

  const updated = await this.prisma.rendezVous.update({
    where: { id: rdvId },
    data: dataPatch,
  });

  // 🔔 Notifications RDV
  if (rdv.typeSlot === 'PRIS' && nextTypeSlot !== 'PRIS') {
    await this.notificationService.notifyRdvAnnulation(rdvId, actor);
  }

  if (rdv.typeSlot !== 'PRIS' && nextTypeSlot === 'PRIS') {
    await this.notificationService.notifyRdvConfirmation(rdvId, actor);
  }

  if (rdv.typeSlot === 'PRIS' && nextTypeSlot === 'PRIS') {
    await this.notificationService.notifyRdvModification(rdvId, actor);
  }

  // 📩 Formulaire — activation après coup (médecin / secrétaire)
  if (
    dto.formulaireDemande === true &&
    rdv.formulaireDemande === false &&
    updated.typeSlot === 'PRIS'
  ) {
    const targetPatientId =
      updated.patientId ??
      (updated.procheId
        ? (
            await this.prisma.proche.findUnique({
              where: { id: updated.procheId },
              select: { patientId: true },
            })
          )?.patientId
        : null);

    if (targetPatientId) {
      await this.formulaireService.createForRdv(
        updated.id,
        targetPatientId,
        updated.medecinId!,
      );

      const patient = await this.prisma.patient.findUnique({
        where: { id: targetPatientId },
        select: { email: true },
      });

      if (patient?.email) {
        await this.formulaireService.sendFormulaireEmail(
          patient.email,
          updated.id,
        );
      }
    }
  }

  return { success: true, rdv: updated };
}


async getDaySchedule(medecinId: number, date: string) {
  const day = new Date(`${date}T00:00:00.000Z`);
  if (isNaN(day.getTime())) {
    throw new BadRequestException('Date invalide.');
  }

  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  const hours = this.generateDaySlots();

  const rdvs = await this.prisma.rendezVous.findMany({
    where: {
      medecinId,
      date: { gte: dayStart, lte: dayEnd },
    },
    include: { patient: true, proche: true },
  });

  const rdvByHour = new Map<string, any>();
  for (const rdv of rdvs) {
    rdvByHour.set(rdv.heure, rdv);
  }

  const slots: Array<{
    heure: string;
    typeSlot: 'LIBRE' | 'PRIS' | 'BLOQUE' | 'HORS';
    rdvId: number | null;
    label?: string;
    source: 'REAL' | 'EMPTY';
  }> = [];

  for (const heure of hours) {
    const rdv = rdvByHour.get(heure);

    // ✅ SLOT RÉEL
    if (rdv) {
      const typeSlot = this.normalizeTypeSlot(rdv.typeSlot);

      if (typeSlot === 'HORS') {
        slots.push({
          heure,
          typeSlot: 'BLOQUE',
          rdvId: rdv.id,
          source: 'REAL',
        });
        continue;
      }

      let label: string | undefined;
      if (typeSlot === 'PRIS') {
        if (rdv.patient) {
          label = `${rdv.patient.prenom} ${rdv.patient.nom}`;
        } else if (rdv.proche) {
          label = `${rdv.proche.prenom} ${rdv.proche.nom}`;
        } else if (rdv.patientIdentity) {
          const id = rdv.patientIdentity as any;
          if (id?.prenom && id?.nom) {
            label = `${id.prenom} ${id.nom}`;
          }
        }
      }

      slots.push({
        heure,
        typeSlot,
        rdvId: rdv.id,
        label,
        source: 'REAL',
      });

      continue;
    }

    // ❌ PLUS JAMAIS DE LIBRE VIRTUEL
    slots.push({
      heure,
      typeSlot: 'HORS',
      rdvId: null,
      source: 'EMPTY',
    });
  }

  return { date, slots };
}





  async findAll(medecinId?: number, patientId?: number, procheId?: number) {
    return this.prisma.rendezVous.findMany({
      where: {
        ...(medecinId ? { medecinId } : {}),
        ...(patientId ? { patientId } : {}),
        ...(procheId ? { procheId } : {}),
      },
      include: {
        patient: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            notePatient: true,
          },
        },
        proche: true,
        medecin: true,
      },
      orderBy: [{ date: 'asc' }, { heure: 'asc' }],
    });
  }


async canBook(
  medecinId: number,
  patientId?: number,
  procheId?: number,
) {
  // ⛔ XOR STRICT
  if (patientId && procheId) {
    throw new BadRequestException(
      'patientId et procheId ne peuvent pas être définis ensemble.',
    );
  }

  // 🔒 1️⃣ RÈGLE RDV FUTUR — PAR CIBLE (PATIENT)
  if (patientId !== undefined && patientId !== null) {
    const hasFuture = await this.patientHasFutureRdvWithMedecin(
      patientId,
      medecinId,
    );

    if (hasFuture) {
      return { canBook: false, reason: 'HAS_FUTURE_RDV' };
    }
  }

  // 🔒 1️⃣ RÈGLE RDV FUTUR — PAR CIBLE (PROCHE)
  if (procheId !== undefined && procheId !== null) {
    const hasFuture = await this.procheHasFutureRdvWithMedecin(
      procheId,
      medecinId,
    );

    if (hasFuture) {
      return { canBook: false, reason: 'HAS_FUTURE_RDV' };
    }
  }

  // 🔒 2️⃣ CSV GATE — IDENTITÉ DE LA CIBLE
  try {
    const identity = await this.getIdentityForBooking(
      patientId ?? null,
      procheId ?? null,
    );

    await this.assertPatientAllowedForMedecin(medecinId, identity);
  } catch {
    return { canBook: false, reason: 'CSV_BLOCK' };
  }

  return { canBook: true };
}





  /* -------------------------------------------------------------
   * SWAP SLOTS (médecin + secrétaire)
   * ✅ - swap 2 RDV quel que soit leur type
   * ✅ - médecin: uniquement dans son planning (même medecinId)
   * ✅ - secrétaire: autorise inter-médecins si même cabinet
   ------------------------------------------------------------- */
async swapSlots(
  firstId: number,
  secondId: number,
  actor: 'medecin' | 'secretaire',
) {
  if (firstId === secondId) {
    throw new BadRequestException('Swap invalide.');
  }

  const [first, second] = await this.prisma.$transaction([
    this.prisma.rendezVous.findUnique({ where: { id: firstId } }),
    this.prisma.rendezVous.findUnique({ where: { id: secondId } }),
  ]);

  if (!first || !second) {
    throw new NotFoundException('RDV introuvable.');
  }

  // règles médecin INCHANGÉES
  if (actor === 'medecin' && first.medecinId !== second.medecinId) {
    throw new BadRequestException('Swap interdit hors planning médecin.');
  }

  // règles secrétaire : même cabinet si 2 médecins
  if (
    actor === 'secretaire' &&
    first.medecinId &&
    second.medecinId &&
    first.medecinId !== second.medecinId
  ) {
    const [m1, m2] = await Promise.all([
      this.prisma.medecin.findUnique({
        where: { id: first.medecinId },
        select: { cabinetId: true },
      }),
      this.prisma.medecin.findUnique({
        where: { id: second.medecinId },
        select: { cabinetId: true },
      }),
    ]);

    if (!m1 || !m2 || m1.cabinetId !== m2.cabinetId) {
      throw new BadRequestException('Swap inter-cabinets interdit.');
    }
  }

  const posA = { date: first.date, heure: first.heure, medecinId: first.medecinId };
  const posB = { date: second.date, heure: second.heure, medecinId: second.medecinId };

  try {
    // 🔁 TENTATIVE SWAP NATIF
    await this.prisma.$transaction(async (tx) => {
      await tx.rendezVous.update({
        where: { id: firstId },
        data: { date: new Date('2099-12-31'), heure: '00:00', medecinId: first.medecinId },
      });

      await tx.rendezVous.update({
        where: { id: secondId },
        data: posA,
      });

      await tx.rendezVous.update({
        where: { id: firstId },
        data: posB,
      });
    });
  } catch {
    // 🔥 FALLBACK GARANTI
    // B → tmp
    const tmp = await this.prisma.rendezVous.update({
      where: { id: secondId },
      data: { date: new Date('2099-12-30'), heure: '23:45', medecinId: second.medecinId },
    });

    // A → B
    await this.prisma.rendezVous.update({
      where: { id: firstId },
      data: posB,
    });

    // B → A
    await this.prisma.rendezVous.update({
      where: { id: secondId },
      data: posA,
    });
  }

  return { success: true };
}



async getForPatient(patientId: number, type: 'futurs' | 'passes') {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return this.prisma.rendezVous.findMany({
    where: {
      typeSlot: 'PRIS',

      AND: [
        {
          OR: [
            // Moi
            { patientId },

            // Proche réel
            { proche: { patientId } },

            // 🔥 Proche "logique" (CSV / secrétaire / historique)
            {
              AND: [
                { patientId: null },
                { patientIdentity: { not: Prisma.JsonNull } },
              ],
            },
          ],
        },

        type === 'futurs'
          ? {
              OR: [
                { date: { gt: today } },
                {
                  AND: [
                    { date: today },
                    { heure: { gt: currentTime } },
                  ],
                },
              ],
            }
          : {
              OR: [
                { date: { lt: today } },
                {
                  AND: [
                    { date: today },
                    { heure: { lte: currentTime } },
                  ],
                },
              ],
            },
      ],
    },
    include: {
      medecin: true,
      proche: true,
    },
    orderBy: [
      { date: type === 'futurs' ? 'asc' : 'desc' },
      { heure: type === 'futurs' ? 'asc' : 'desc' },
    ],
  });
}


  /* -------------------------------------------------------------
   * Création slot vierge (médecin)
   ------------------------------------------------------------- */
async createSlot(data: {
  medecinId: number;
  date: string;
  heure: string;
  typeSlot?: 'LIBRE' | 'PRIS' | 'BLOQUE' | 'HORS';
}) {
  const dateObj = new Date(`${data.date}T00:00:00.000Z`);
  if (isNaN(dateObj.getTime())) {
    throw new BadRequestException('Date invalide.');
  }

  const medecinId = Number(data.medecinId);
  if (!medecinId || isNaN(medecinId)) {
    throw new BadRequestException('medecinId obligatoire.');
  }

  if (!data.heure) {
    throw new BadRequestException('Heure obligatoire.');
  }

  // 🔑 Création explicite = toujours LIBRE
  const targetType: 'LIBRE' = 'LIBRE';

  // 1️⃣ chercher un slot existant
  const existing = await this.prisma.rendezVous.findFirst({
    where: {
      medecinId,
      date: dateObj,
      heure: data.heure,
    },
  });

  // ✅ FIX : PATCH ABSOLU
  // → on écrase TOUT, y compris un ancien HORS
  if (existing) {
    const { dataPatch } = this.buildTransitionPatch(existing, {
      typeSlot: targetType,
    });

    const updated = await this.prisma.rendezVous.update({
      where: { id: existing.id },
      data: dataPatch,
      include: {
        patient: true,
        proche: true,
        medecin: true,
      },
    });

    return { success: true, rdv: updated };
  }

  // 2️⃣ sinon, création normale
  const rdv = await this.prisma.rendezVous.create({
    data: {
      medecinId,
      date: dateObj,
      heure: data.heure,
      typeSlot: targetType,
    },
    include: {
      patient: true,
      proche: true,
      medecin: true,
    },
  });

  return { success: true, rdv };
}


async applyScheduleInterval(params: {
  medecinId: number;
  date: string;
  start: string;
  end: string;
}) {
  const { medecinId, date, start, end } = params;

const heures = this.splitInterval(start, end);


  return this.prisma.$transaction(async (tx) => {
    // 1️⃣ DELETE HARD de TOUT ce qui existe dans l’intervalle
const dateObj = new Date(`${date}T00:00:00.000Z`);

await tx.rendezVous.deleteMany({
  where: {
    medecinId,
    date: dateObj,
    heure: { in: heures },
  },
});


    // 2️⃣ CREATE des slots LIBRE
    for (const heure of heures) {
await tx.rendezVous.create({
  data: {
    medecinId,
    date: dateObj,
    heure,
    typeSlot: "LIBRE",
  },
});

    }
  });
}

// RdvService.ts
async deleteSlotHard(rdvId: number) {
  await this.prisma.rendezVous.delete({
    where: { id: rdvId },
  });

  return { success: true };
}

  /* -------------------------------------------------------------
   * FIND ONE
   ------------------------------------------------------------- */
  findOne(id: number) {
    return this.prisma.rendezVous.findUnique({
      where: { id },
      include: { patient: true, proche: true, medecin: true, formulaire: true },
    });
  }

  /* -------------------------------------------------------------
   * Création RDV (médecin)
   ------------------------------------------------------------- */
async create(dto: CreateRdvDto) {
  const medecinId = Number(dto.medecinId);
  if (isNaN(medecinId)) {
    throw new BadRequestException('medecinId invalide.');
  }

  const rawDate = new Date(dto.date);
  if (isNaN(rawDate.getTime())) {
    throw new BadRequestException('Date invalide.');
  }

  const date = new Date(rawDate);
  date.setHours(0, 0, 0, 0);

  const heure = dto.heure;
  if (!heure) {
    throw new BadRequestException('Heure obligatoire.');
  }

  const typeSlot =
    dto.typeSlot
      ? this.normalizeTypeSlot(dto.typeSlot)
      : dto.patientId || dto.procheId
      ? 'PRIS'
      : 'LIBRE';

  let patientId: number | null = null;
  let procheId: number | null = null;
  let patientIdentity: Prisma.InputJsonValue | undefined = undefined;

  if (typeSlot === 'PRIS') {
    if (dto.patientId !== undefined && dto.patientId !== null) {
      patientId = Number(dto.patientId);
      if (isNaN(patientId)) {
        throw new BadRequestException('patientId invalide.');
      }
    }

    if (dto.procheId !== undefined && dto.procheId !== null) {
      procheId = Number(dto.procheId);
      if (isNaN(procheId)) {
        throw new BadRequestException('procheId invalide.');
      }
    }

    if (patientId && procheId) {
      throw new BadRequestException(
        'Un RDV ne peut pas être pour un patient ET un proche.',
      );
    }

    if (dto.patientIdentity) {
      patientIdentity = {
        source: dto.patientIdentity.source,
        nom: dto.patientIdentity.nom,
        prenom: dto.patientIdentity.prenom,
        dateNaissance: dto.patientIdentity.dateNaissance ?? null,
      } as Prisma.InputJsonValue;
    }

    if (!patientId && !procheId) {
      throw new BadRequestException(
        'Un rendez-vous PRIS doit être rattaché à un patient ou un proche.',
      );
    }
  }

  // 🔑 MÉDECIN / SECRÉTAIRE → décision explicite
  const formulaireDemande = dto.formulaireDemande === true;

  const rdv = await this.prisma.rendezVous.create({
    data: {
      medecinId,
      date,
      heure,
      typeSlot,
      typeConsultation: this.normalizeConsultationType(
        dto.typeConsultation ?? 'PRESENTIEL',
      ),
      patientId,
      procheId,
      patientIdentity,
      formulaireDemande,
    },
    include: {
      patient: true,
      proche: true,
      medecin: true,
    },
  });

  // 📩 FORMULAIRE UNIQUEMENT SI DEMANDÉ
  if (typeSlot === 'PRIS' && formulaireDemande) {
    const targetPatientId =
      patientId ??
      (procheId
        ? (
            await this.prisma.proche.findUnique({
              where: { id: procheId },
              select: { patientId: true },
            })
          )?.patientId
        : null);

    if (targetPatientId) {
      await this.formulaireService.createForRdv(
        rdv.id,
        targetPatientId,
        medecinId,
      );

      const patient = await this.prisma.patient.findUnique({
        where: { id: targetPatientId },
        select: { email: true },
      });

      if (patient?.email) {
        await this.formulaireService.sendFormulaireEmail(
          patient.email,
          rdv.id,
        );
      }
    }
  }

  return rdv;
}


// RdvService.ts

async swapByMedecinView(firstId: number, secondId: number) {
  return this.swapInternal(firstId, secondId);
}

  /* -------------------------------------------------------------
   * Création RDV (patient)
   * ⚠️ NE PAS TOUCHER (exigence projet)
   ------------------------------------------------------------- */
async createForPatient(dto: CreateRdvDto) {
  // -------------------------------
  // 0️⃣ Validation basique
  // -------------------------------
  const dateObj = new Date(dto.date);
  if (isNaN(dateObj.getTime())) {
    throw new BadRequestException('Date invalide.');
  }

  const medecinId = Number(dto.medecinId);
  if (!medecinId || isNaN(medecinId)) {
    throw new BadRequestException('ID médecin invalide.');
  }

  const patientId =
    dto.patientId !== undefined && dto.patientId !== null
      ? Number(dto.patientId)
      : null;

  const procheId =
    dto.procheId !== undefined && dto.procheId !== null
      ? Number(dto.procheId)
      : null;

  if (!patientId && !procheId) {
    throw new BadRequestException('Patient ou proche obligatoire.');
  }

  if (patientId && procheId) {
    throw new BadRequestException(
      'Un RDV ne peut pas être pour un patient ET un proche.',
    );
  }

  // -------------------------------
  // 1️⃣ Sécurité existence patient owner
  // -------------------------------
  await this.assertPatientExists(patientId);

  // -------------------------------
  // 🔒 2️⃣ RÈGLE MÉTIER — PAR CIBLE (FIX CRITIQUE)
  // -------------------------------
  if (patientId && !procheId) {
    const hasFuture = await this.patientHasFutureRdvWithMedecin(
      patientId,
      medecinId,
    );

    if (hasFuture) {
      throw new ForbiddenException(
        'Vous avez déjà un rendez-vous futur avec ce médecin.',
      );
    }
  }

  if (procheId) {
    const hasFuture = await this.procheHasFutureRdvWithMedecin(
      procheId,
      medecinId,
    );

    if (hasFuture) {
      throw new ForbiddenException(
        'Ce proche a déjà un rendez-vous futur avec ce médecin.',
      );
    }
  }

  // -------------------------------
  // 🔒 3️⃣ CSV GATE — IDENTITÉ DE LA CIBLE
  // -------------------------------
  const identity = await this.getIdentityForBooking(
    patientId,
    procheId,
  );

  await this.assertPatientAllowedForMedecin(medecinId, identity);

  // -------------------------------
  // 4️⃣ Préparation RDV
  // -------------------------------
  const typeConsultation = this.normalizeConsultationType(
    dto.typeConsultation,
  );

  const slot = await this.prisma.rendezVous.findFirst({
    where: {
      medecinId,
      date: dateObj,
      heure: dto.heure,
    },
  });

  // --------------------------------------------------
  // CAS 1 : aucun slot → création
  // --------------------------------------------------
  if (!slot) {
    const rdv = await this.prisma.rendezVous.create({
      data: {
        medecinId,
        date: dateObj,
        heure: dto.heure,
        patientId,
        procheId,
        motif: dto.motif ?? null,
        typeSlot: 'PRIS',
        typeConsultation,
      },
      include: {
        patient: true,
        proche: true,
        medecin: true,
      },
    });

    await this.notificationService.notifyRdvConfirmation(
      rdv.id,
      'patient',
    );

    if (patientId) {
      await this.formulaireService.createForRdv(
        rdv.id,
        patientId,
        medecinId,
      );

      const patient = await this.prisma.patient.findUnique({
        where: { id: patientId },
        select: { email: true },
      });

      if (patient?.email) {
        await this.formulaireService.sendFormulaireEmail(
          patient.email,
          rdv.id,
        );
      }
    }

    return rdv;
  }

  // --------------------------------------------------
  // CAS 2 : slot existant non LIBRE
  // --------------------------------------------------
  if (slot.typeSlot !== 'LIBRE') {
    throw new BadRequestException('Créneau non disponible.');
  }

  // --------------------------------------------------
  // CAS 3 : slot LIBRE → update
  // --------------------------------------------------
  const rdv = await this.prisma.rendezVous.update({
    where: { id: slot.id },
    data: {
      patientId,
      procheId,
      motif: dto.motif ?? null,
      typeSlot: 'PRIS',
      typeConsultation,
    },
    include: {
      patient: true,
      proche: true,
      medecin: true,
    },
  });

  await this.notificationService.notifyRdvConfirmation(
    rdv.id,
    'patient',
  );

  if (patientId) {
    await this.formulaireService.createForRdv(
      rdv.id,
      patientId,
      medecinId,
    );

    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { email: true },
    });

    if (patient?.email) {
      await this.formulaireService.sendFormulaireEmail(
        patient.email,
        rdv.id,
      );
    }
  }

  return rdv;
}



/* -------------------------------------------------------------
 * MOVE RDV (médecin)
 * - déplacement vers une case vide
 * - création + suppression atomique
 ------------------------------------------------------------- */
async moveRdvForMedecin(params: {
  rdvId: number;
  toDate: string;
  toHour: string;
  medecinId: number;
}) {
  const { rdvId, toDate, toHour, medecinId } = params;

  const targetDate = new Date(toDate);
  if (isNaN(targetDate.getTime())) {
    throw new BadRequestException('Date cible invalide.');
  }

  if (!toHour) {
    throw new BadRequestException('Heure cible obligatoire.');
  }

  return this.prisma.$transaction(async (tx) => {
    const source = await tx.rendezVous.findUnique({
      where: { id: rdvId },
    });

    if (!source) {
      throw new NotFoundException('RDV introuvable.');
    }

    if (source.medecinId !== medecinId) {
      throw new ForbiddenException(
        'Impossible de déplacer un RDV hors de votre planning.',
      );
    }

    // 🔒 collision sur le créneau cible
    const collision = await tx.rendezVous.findFirst({
      where: {
        medecinId,
        date: targetDate,
        heure: toHour,
        NOT: { id: rdvId }, // 🔑 important
      },
      select: { id: true },
    });

    if (collision) {
      throw new BadRequestException(
        'Un autre rendez-vous existe déjà sur ce créneau.',
      );
    }

    // ✅ UPDATE IN-PLACE (aucun DELETE)
    const updated = await tx.rendezVous.update({
      where: { id: rdvId },
      data: {
        date: targetDate,
        heure: toHour,
      },
    });

    // notification si RDV PRIS
    if (source.typeSlot === 'PRIS') {
      await this.notificationService.notifyRdvModification(
        updated.id,
        'medecin',
      );
    }

    return { success: true, rdv: updated };
  });
}


  /* -------------------------------------------------------------
   * REMOVE (soft)
   ------------------------------------------------------------- */
  async remove(
    id: number,
    actor: 'patient' | 'medecin' | 'secretaire' | 'system' = 'medecin',
  ) {
    const rdv = await this.prisma.rendezVous.findUnique({
      where: { id },
      include: { patient: true, proche: true, medecin: true },
    });

    if (!rdv) throw new NotFoundException('RDV introuvable.');

    if (rdv.typeSlot === 'PRIS' && (rdv.patientId || rdv.procheId)) {
      await this.notificationService.notifyRdvAnnulation(rdv.id, actor);
    }

    await this.formulaireService.deleteForRdv(id).catch(() => {});

    const updated = await this.prisma.rendezVous.update({
      where: { id },
      data: {
        patientId: null,
        procheId: null,
        motif: null,
        typeSlot: 'LIBRE',
      },
      include: { patient: true, proche: true, medecin: true },
    });

    return { success: true, rdv: updated };
  }

  /* -------------------------------------------------------------
   * Disponibilités patient : slots LIBRES (future only)
   ------------------------------------------------------------- */
async getDisponibilites(
  medecinId: number,
  dateStr: string,
  patientId?: number,
  procheId?: number,
) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new BadRequestException('Date invalide.');
  }

  // ⛔ XOR STRICT
  if (patientId && procheId) {
    throw new BadRequestException(
      'patientId et procheId ne peuvent pas être définis ensemble.',
    );
  }

  // 🔒 1️⃣ RÈGLE RDV FUTUR — STOP TOTAL (PATIENT)
  if (patientId !== undefined && patientId !== null) {
    const hasFuture = await this.patientHasFutureRdvWithMedecin(
      patientId,
      medecinId,
    );
    if (hasFuture) return [];
  }

  // 🔒 1️⃣ RÈGLE RDV FUTUR — STOP TOTAL (PROCHE)
  if (procheId !== undefined && procheId !== null) {
    const hasFuture = await this.procheHasFutureRdvWithMedecin(
      procheId,
      medecinId,
    );
    if (hasFuture) return [];
  }

  // 🔒 2️⃣ CSV GATE
  if (
    (patientId !== undefined && patientId !== null) ||
    (procheId !== undefined && procheId !== null)
  ) {
    const identity = await this.getIdentityForBooking(
      patientId ?? null,
      procheId ?? null,
    );

    await this.assertPatientAllowedForMedecin(medecinId, identity);
  }

  // --- reste STRICTEMENT inchangé
  const dayStart = new Date(dateStr + 'T00:00:00.000Z');
  const dayEnd = new Date(dateStr + 'T23:59:59.999Z');

  const rdvs = await this.prisma.rendezVous.findMany({
    where: {
      medecinId,
      date: { gte: dayStart, lte: dayEnd },
    },
    select: { heure: true, typeSlot: true },
  });

  const unavailable = new Set<string>();
  rdvs.forEach((r) => {
    if (this.normalizeTypeSlot(r.typeSlot) !== 'LIBRE') {
      unavailable.add(r.heure);
    }
  });

  return rdvs
    .filter((r) => this.normalizeTypeSlot(r.typeSlot) === 'LIBRE')
    .map((r) => r.heure)
    .filter((h) => !unavailable.has(h));
}



  /* -------------------------------------------------------------
   * Planning médecin : période
   ------------------------------------------------------------- */
async getByMedecinAndPeriod(
  medecinId: number,
  start: Date,
  end: Date,
) {
  const rdvs = await this.prisma.rendezVous.findMany({
    where: {
      medecinId,
      date: {
        gte: start,
        lt: end,
      },
    },
    include: {
      patient: {
        select: { id: true, nom: true, prenom: true },
      },
      proche: {
        select: { id: true, nom: true, prenom: true },
      },
    },
    orderBy: [{ date: 'asc' }, { heure: 'asc' }],
  });

  return rdvs.map((r) => {
    const normalizedType = this.normalizeTypeSlot(r.typeSlot);

    let patientDisplayName: string | null = null;

    if (normalizedType === 'PRIS') {
      if (r.patient) {
        patientDisplayName = `${r.patient.prenom} ${r.patient.nom}`;
      } else if (r.proche) {
        patientDisplayName = `${r.proche.prenom} ${r.proche.nom}`;
      } else if (r.patientIdentity) {
        const id = r.patientIdentity as any;
        if (id?.prenom && id?.nom) {
          patientDisplayName = `${id.prenom} ${id.nom}`;
        }
      }
    }

    return {
      ...r,
      typeSlot: normalizedType,
      patientDisplayName,
    };
  });
}




  /* -------------------------------------------------------------
   * Planning cabinet jour
   ------------------------------------------------------------- */
async getPlanningForCabinetDay(cabinetId: number, dateStr: string) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new BadRequestException('Date invalide.');
  }

  const dayStartUTC = new Date(`${dateStr}T00:00:00.000Z`);
  const dayEndUTC = new Date(`${dateStr}T23:59:59.999Z`);

  // 1️⃣ Médecins du cabinet
  const medecins = await this.prisma.medecin.findMany({
    where: { cabinetId },
    select: {
      id: true,
      nom: true,
      prenom: true,
      horaires: true,
      horairesReference: true,
      horairesExceptionnels: {
        where: {
          date: { gte: dayStartUTC, lte: dayEndUTC },
        },
      },
    },
  });

  // 2️⃣ Grille horaire fixe
  const hours: string[] = [];
  for (let h = 7; h < 23; h++) {
    for (let m = 0; m < 60; m += 15) {
      hours.push(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      );
    }
  }

  // Helper horaires (meta + seed)
  const getHorairesForDay = (med: any): Array<{ start: string; end: string }> => {
    // Exceptionnels (déjà filtrés sur le jour)
    const exception = med.horairesExceptionnels?.[0]?.horaires;
    const raw = exception ?? med.horairesReference ?? med.horaires ?? {};

    // raw peut être un objet { lundi: [...] } ou directement un tableau
    const dayKey = date
      .toLocaleDateString('fr-FR', { weekday: 'long' })
      .toLowerCase();

    const dayPlages = Array.isArray(raw) ? raw : raw?.[dayKey] ?? [];

    // Normalisation en [{start,end}]
    // Supporte:
    // - { start: "08:00", end: "12:00" }
    // - "08:00-12:00"
    // - "08:00 / 12:00" (tolérant)
    const normalized: Array<{ start: string; end: string }> = [];
    for (const p of dayPlages) {
      if (p && typeof p === 'object' && p.start && p.end) {
        normalized.push({ start: String(p.start).trim(), end: String(p.end).trim() });
        continue;
      }
      if (typeof p === 'string') {
        const s = p.trim();
        const m = s.match(/^(\d{2}:\d{2})\s*[-/]\s*(\d{2}:\d{2})$/);
        if (m) normalized.push({ start: m[1], end: m[2] });
      }
    }

    return normalized;
  };

  // 3️⃣ Récupère les RDV existants du jour pour le cabinet (source de vérité)
  const existingRdvs = await this.prisma.rendezVous.findMany({
    where: {
      medecin: { cabinetId },
      date: { gte: dayStartUTC, lte: dayEndUTC },
    },
    select: {
      id: true,
      medecinId: true,
      date: true,
      heure: true,
      typeSlot: true,
    },
  });

  // Index (medecinId + heure) -> id existant
  const existingKey = new Set<string>();
  for (const r of existingRdvs) {
    if (!r.medecinId) continue;
    existingKey.add(`${r.medecinId}_${r.heure}`);
  }

  // 4️⃣ ✅ SEED DB: crée des slots LIBRE réels DANS LES HORAIRES si absents
  // (indispensable pour avoir rdvId en vue cabinet)
  const toCreate: Array<{
    medecinId: number;
    date: Date;
    heure: string;
    typeSlot: 'LIBRE';
    typeConsultation: 'PRESENTIEL';
  }> = [];

  for (const med of medecins) {
    const plages = getHorairesForDay(med);

    for (const heure of hours) {
      const inHoraires = this.isInHoraires(heure, plages);
      if (!inHoraires) continue;

      const key = `${med.id}_${heure}`;
      if (existingKey.has(key)) continue;

      toCreate.push({
        medecinId: med.id,
        date: dayStartUTC,              // date-only UTC
        heure,
        typeSlot: 'LIBRE',
        typeConsultation: 'PRESENTIEL', // fallback sûr (ajuste si tu veux)
      });
    }
  }

  if (toCreate.length) {
    // IMPORTANT: nécessite idéalement une contrainte unique (medecinId, date, heure).
    // Si elle existe, skipDuplicates protège contre les courses.
    await this.prisma.rendezVous.createMany({
      data: toCreate as any,
      skipDuplicates: true,
    });
  }

  // 5️⃣ Re-fetch complet (avec patient/proche/identity) pour construire le planning final
  const rdvs = await this.prisma.rendezVous.findMany({
    where: {
      medecin: { cabinetId },
      date: { gte: dayStartUTC, lte: dayEndUTC },
    },
    include: {
      patient: {
        select: { id: true, nom: true, prenom: true, notePatient: true },
      },
      proche: {
        select: { id: true, nom: true, prenom: true },
      },
    },
  });

  // Index RDV par médecin + heure
  const rdvByMedecinAndHour = new Map<string, any>();
  for (const rdv of rdvs) {
    if (!rdv.medecinId) continue;
    rdvByMedecinAndHour.set(`${rdv.medecinId}_${rdv.heure}`, rdv);
  }

  // 6️⃣ Construction planning (rdvId garanti dans les horaires)
  const medecinsPlanning = medecins.map((med) => {
    const plages = getHorairesForDay(med);

    const slots = hours.map((heure) => {
      const rdv = rdvByMedecinAndHour.get(`${med.id}_${heure}`);
      const inHoraires = this.isInHoraires(heure, plages);

      // ✅ SLOT RÉEL (existe en base)
      if (rdv) {
        return {
          heure,
          typeSlot: this.normalizeTypeSlot(rdv.typeSlot),
          isVirtual: false,
          rdvId: rdv.id,
          patient: rdv.patient,
          proche: rdv.proche,
          patientIdentity: (rdv.patientIdentity ?? null) as any,
          motif: rdv.motif,
          typeConsultation: rdv.typeConsultation,
        };
      }

      // Hors horaires => virtuel HORS
      // Dans les horaires, après seed, on ne devrait plus tomber ici;
      // mais on garde un fallback safe.
      if (!inHoraires) {
        return {
          heure,
          typeSlot: 'HORS',
          isVirtual: true,
          rdvId: null,
        };
      }

      return {
        heure,
        typeSlot: 'LIBRE',
        isVirtual: false,
        rdvId: null, // fallback (ne devrait pas arriver si seed OK)
      };
    });

    return {
      id: med.id,
      nom: med.nom,
      prenom: med.prenom,
      horaires: plages, // meta (affichage)
      slots,
    };
  });

  return {
    date: dateStr,
    medecins: medecinsPlanning,
  };
}



  /* -------------------------------------------------------------
 * UPLOAD / REPLACE RDV (médecin)
 * Objectif :
 * - On considère le créneau comme "vide"
 * - On SUPPRIME l'existant sur (medecinId, date, heure) s'il existe
 * - On CRÉE un nouveau RDV complet avec le payload upload
 * - Transactionnel (atomique)
 ------------------------------------------------------------- */
async uploadReplaceForMedecin(dto: CreateRdvDto) {
  // ───────────────────────────────────────────
  // 1️⃣ VALIDATIONS DE BASE
  // ───────────────────────────────────────────
  if (!dto.date || !dto.heure) {
    throw new BadRequestException('date et heure obligatoires.');
  }

  const rawDate = new Date(dto.date);
  if (isNaN(rawDate.getTime())) {
    throw new BadRequestException('Date invalide.');
  }

  // date-only UTC (aligné avec tout le service)
  const date = new Date(rawDate);
  date.setHours(0, 0, 0, 0);

  const heure = dto.heure;

  const medecinId = Number(dto.medecinId);
  if (!medecinId || isNaN(medecinId)) {
    throw new BadRequestException('medecinId invalide.');
  }

  if (dto.patientId && dto.procheId) {
    throw new BadRequestException(
      'Un RDV ne peut pas être pour un patient ET un proche.',
    );
  }

  const patientId =
    dto.patientId !== undefined && dto.patientId !== null
      ? Number(dto.patientId)
      : null;

  let procheId =
    dto.procheId !== undefined && dto.procheId !== null
      ? Number(dto.procheId)
      : null;

  await this.assertPatientExists(patientId);

  // ───────────────────────────────────────────
  // 2️⃣ IDENTITÉ / CSV
  // ───────────────────────────────────────────
  let patientIdentity: Prisma.InputJsonValue | undefined;

  if (dto.patientIdentity) {
    patientIdentity = {
      source: dto.patientIdentity.source,
      nom: dto.patientIdentity.nom,
      prenom: dto.patientIdentity.prenom,
      dateNaissance: dto.patientIdentity.dateNaissance ?? null,
    } as Prisma.InputJsonValue;

    // CSV strict si demandé par le front
    if (dto.patientIdentity.source === 'CSV') {
      const { nom, prenom, dateNaissance } = dto.patientIdentity;

      if (!nom || !prenom || !dateNaissance) {
        throw new BadRequestException(
          'Nom, prénom et date de naissance requis pour un patient CSV.',
        );
      }

      await this.assertIdentityInCsvForMedecin(medecinId, {
        nom,
        prenom,
        dateNaissance,
      });
    }
  }

  // rattachement automatique proche depuis identité (si possible)
  if (!patientId && !procheId && patientIdentity && dto.patientId) {
    const resolvedProcheId = await this.resolveProcheFromIdentity(
      Number(dto.patientId),
      patientIdentity as any,
    );

    if (resolvedProcheId) {
      procheId = resolvedProcheId;
    }
  }

  const typeSlot = this.normalizeTypeSlot(dto.typeSlot ?? 'PRIS');
  const typeConsultation = this.normalizeConsultationType(
    dto.typeConsultation,
  );

  if (typeSlot === 'PRIS' && !patientId && !procheId && !patientIdentity) {
    throw new BadRequestException(
      'Un RDV PRIS doit avoir patientId, procheId ou une identité.',
    );
  }

  // ───────────────────────────────────────────
  // 3️⃣ TRANSACTION : DELETE + CREATE
  // ───────────────────────────────────────────
  return this.prisma.$transaction(async (tx) => {
    const existing = await tx.rendezVous.findFirst({
      where: { medecinId, date, heure },
      select: { id: true, typeSlot: true, patientId: true, procheId: true },
    });

    // 🔥 SUPPRESSION TOTALE DE L’EXISTANT
    if (existing) {
      await this.formulaireService.deleteForRdv(existing.id).catch(() => {});

      if (
        existing.typeSlot === 'PRIS' &&
        (existing.patientId || existing.procheId)
      ) {
        await this.notificationService.notifyRdvModification(
          existing.id,
          'medecin',
        );
      }

      await tx.rendezVous.delete({
        where: { id: existing.id },
      });
    }

    // ✅ CRÉATION UNIQUE (SOURCE DE VÉRITÉ)
    const created = await tx.rendezVous.create({
      data: {
        medecinId,
        date,
        heure,
        motif: dto.motif ?? null,
        typeSlot,
        typeConsultation,
        patientId,
        procheId,
        patientIdentity,
      },
      include: {
        patient: true,
        proche: true,
        medecin: true,
      },
    });

    // ───────────────────────────────────────────
    // 4️⃣ POST-CREATE (notifications / formulaire)
    // ───────────────────────────────────────────
    if (typeSlot === 'PRIS') {
      await this.notificationService.notifyRdvConfirmation(
        created.id,
        'medecin',
      );

      if (patientId) {
        await this.formulaireService.createForRdv(
          created.id,
          patientId,
          medecinId,
        );

        const patient = await tx.patient.findUnique({
          where: { id: patientId },
          select: { email: true },
        });

        if (patient?.email) {
          await this.formulaireService.sendFormulaireEmail(
            patient.email,
            created.id,
          );
        }
      }
    }

    return { success: true, rdv: created };
  });
}


// RDV.SERVICE.TS

async moveRdvForSecretaire(params: {
  rdvId: number;
  toDate: string;
  toHour: string;
  toMedecinId: number;
}) {
  const { rdvId, toDate, toHour, toMedecinId } = params;

  const targetDate = new Date(toDate);
  if (isNaN(targetDate.getTime())) {
    throw new BadRequestException('Date cible invalide.');
  }
  if (!toHour) {
    throw new BadRequestException('Heure cible obligatoire.');
  }

  const destMedecinId = Number(toMedecinId);
  if (!destMedecinId || isNaN(destMedecinId)) {
    throw new BadRequestException('Médecin cible invalide.');
  }

  return this.prisma.$transaction(async (tx) => {
    const source = await tx.rendezVous.findUnique({
      where: { id: rdvId },
      select: { id: true, medecinId: true, date: true, heure: true, typeSlot: true, patientId: true, procheId: true },
    });

    if (!source) {
      throw new NotFoundException('RDV introuvable.');
    }

    // --- sécurité secrétaire : inter-médecins seulement si même cabinet
    if (!source.medecinId) {
      throw new BadRequestException('Impossible de déplacer un RDV sans médecin associé.');
    }

    if (source.medecinId !== destMedecinId) {
      const [m1, m2] = await Promise.all([
        tx.medecin.findUnique({ where: { id: source.medecinId }, select: { id: true, cabinetId: true } }),
        tx.medecin.findUnique({ where: { id: destMedecinId }, select: { id: true, cabinetId: true } }),
      ]);

      if (!m1 || !m2) throw new NotFoundException('Médecin introuvable.');

      if (!m1.cabinetId || !m2.cabinetId || m1.cabinetId !== m2.cabinetId) {
        throw new BadRequestException(
          'Impossible de déplacer un RDV entre médecins de cabinets différents.',
        );
      }
    }

    // --- collision sur le créneau cible (chez le médecin cible)
    const collision = await tx.rendezVous.findFirst({
      where: {
        medecinId: destMedecinId,
        date: targetDate,
        heure: toHour,
        NOT: { id: rdvId },
      },
      select: { id: true },
    });

    if (collision) {
      throw new BadRequestException('Un autre rendez-vous existe déjà sur ce créneau.');
    }

    // --- update in-place (aucun delete)
    const updated = await tx.rendezVous.update({
      where: { id: rdvId },
      data: {
        medecinId: destMedecinId,
        date: targetDate,
        heure: toHour,
      },
      include: { patient: true, proche: true, medecin: true },
    });

    // notif si RDV PRIS
    if (source.typeSlot === 'PRIS') {
      await this.notificationService.notifyRdvModification(updated.id, 'secretaire');
    }

    return { success: true, rdv: updated };
  });
}
}
