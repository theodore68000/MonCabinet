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

  

  // ------------------------------------------------------------------
  // IMMUTABILITÉ RDV
  // Toute modification/swap/move/libération = DELETE + CREATE
  // ------------------------------------------------------------------

  private toDateOnlyUTC(input: Date): Date {
    const ymd = input.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    return new Date(`${ymd}T00:00:00.000Z`);
  }

  private buildCreateDtoFromRdv(rdv: any): CreateRdvDto {
    return {
      date: this.toDateOnlyUTC(new Date(rdv.date)).toISOString().slice(0, 10),
      heure: rdv.heure,
      motif: rdv.motif ?? null,
      patientId: rdv.patientId ?? null,
      procheId: rdv.procheId ?? null,
      medecinId: rdv.medecinId,
      typeConsultation: this.normalizeConsultationType(rdv.typeConsultation),
      typeSlot: this.normalizeTypeSlot(rdv.typeSlot),
      patientIdentity: (rdv.patientIdentity ?? undefined) as any,
      formulaireDemande: rdv.formulaireDemande === true,
    };
  }

private async replaceRdvByDeleteCreate(params: {
  tx: Prisma.TransactionClient;
  sourceId: number;
  override: Partial<CreateRdvDto>;
}) {
  const { tx, sourceId, override } = params;

  const source = await tx.rendezVous.findUnique({
    where: { id: sourceId },
    include: { patient: true, proche: true, medecin: true, formulaire: true },
  });

  if (!source) {
    throw new NotFoundException('RDV introuvable.');
  }

  // 🔒 base = source COMPLET
  const base = this.buildCreateDtoFromRdv(source);

  // 🔥 FIX : héritage explicite date / heure
  const nextDate = override.date ?? base.date;
  const nextHeure = override.heure ?? base.heure;

  const nextTypeSlot =
    override.typeSlot !== undefined
      ? this.normalizeTypeSlot(override.typeSlot)
      : this.normalizeTypeSlot(base.typeSlot);

  // ⛔ GARDE-FOU ABSOLU
  if (nextTypeSlot === 'PRIS') {
    if (!nextDate || !nextHeure) {
      throw new BadRequestException(
        'RDV PRIS invalide : date et heure obligatoires.',
      );
    }
  }

  // DELETE CASCADE
  await this.deleteRdvCascade(tx, sourceId);

  const created = await tx.rendezVous.create({
    data: {
      medecinId: Number(base.medecinId),
      date: new Date(`${nextDate}T00:00:00.000Z`),
      heure: nextHeure,
      motif: override.motif ?? base.motif ?? null,
      typeSlot: nextTypeSlot,
      typeConsultation:
        override.typeConsultation !== undefined
          ? this.normalizeConsultationType(override.typeConsultation)
          : this.normalizeConsultationType(base.typeConsultation),
      patientId:
        override.patientId !== undefined ? override.patientId : base.patientId,
      procheId:
        override.procheId !== undefined ? override.procheId : base.procheId,
      patientIdentity:
        override.patientIdentity !== undefined
          ? (override.patientIdentity as any)
          : (base.patientIdentity as any),
      formulaireDemande:
        override.formulaireDemande !== undefined
          ? override.formulaireDemande
          : base.formulaireDemande,
    },
    include: { patient: true, proche: true, medecin: true, formulaire: true },
  });

  return { source, created };
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

private async deleteRdvCascade(
  tx: Prisma.TransactionClient,
  rdvId: number,
) {
  // 1️⃣ Formulaire
  await tx.formulairePreconsultation.deleteMany({
    where: { rdvId },
  });

  // 2️⃣ Paiement (⚠️ FK = rendezVousId)
  await tx.paiement.deleteMany({
    where: { rendezVousId: rdvId },
  });

  // 3️⃣ RDV
  await tx.rendezVous.delete({
    where: { id: rdvId },
  });
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
  if (firstId === secondId) {
    throw new BadRequestException('Impossible de swap un RDV avec lui-même.');
  }

  const [a, b] = await this.prisma.$transaction([
    this.prisma.rendezVous.findUnique({ where: { id: firstId } }),
    this.prisma.rendezVous.findUnique({ where: { id: secondId } }),
  ]);

  if (!a || !b) {
    throw new NotFoundException('RDV introuvable.');
  }

  const posA: Partial<CreateRdvDto> = {
    date: this.toDateOnlyUTC(new Date(a.date)).toISOString().slice(0, 10),
    heure: a.heure,
    ...(a.medecinId != null ? { medecinId: a.medecinId } : {}),
  };

  const posB: Partial<CreateRdvDto> = {
    date: this.toDateOnlyUTC(new Date(b.date)).toISOString().slice(0, 10),
    heure: b.heure,
    ...(b.medecinId != null ? { medecinId: b.medecinId } : {}),
  };

  await this.prisma.$transaction(async (tx) => {
    await this.replaceRdvByDeleteCreate({
      tx,
      sourceId: a.id,
      override: {
        ...posB,
        patientId: b.patientId ?? null,
        procheId: b.procheId ?? null,
        patientIdentity: (b.patientIdentity ?? undefined) as any,
        motif: b.motif ?? null,
        typeSlot: b.typeSlot,
        typeConsultation: this.normalizeConsultationType(b.typeConsultation),
        formulaireDemande: b.formulaireDemande === true,
      },
    });

    await this.replaceRdvByDeleteCreate({
      tx,
      sourceId: b.id,
      override: {
        ...posA,
        patientId: a.patientId ?? null,
        procheId: a.procheId ?? null,
        patientIdentity: (a.patientIdentity ?? undefined) as any,
        motif: a.motif ?? null,
        typeSlot: a.typeSlot,
        typeConsultation: this.normalizeConsultationType(a.typeConsultation),
        formulaireDemande: a.formulaireDemande === true,
      },
    });
  });

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

private rdvMatchesProcheIdentity(
  rdv: any,
  proche: { id: number; nom: string; prenom: string }
): boolean {
  // lien direct
  if (rdv.procheId === proche.id) return true;

  // via identité (RDV créé par médecin / secrétaire)
  if (rdv.patientIdentity) {
    return (
      this.normalize(rdv.patientIdentity.nom) === this.normalize(proche.nom) &&
      this.normalize(rdv.patientIdentity.prenom) === this.normalize(proche.prenom)
    );
  }

  return false;
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

  // ❌ SUPPRIMÉ : un RDV d’un proche ne doit PAS compter comme RDV du patient
  // if (rdv.proche && rdv.proche.patientId === patient.id) return true;

  // 2️⃣ via identité JSON (si un RDV a été créé sans patientId mais avec nom/prénom)
  if (rdv.patientIdentity) {
    return (
      this.normalize(rdv.patientIdentity.nom) === this.normalize(patient.nom) &&
      this.normalize(rdv.patientIdentity.prenom) === this.normalize(patient.prenom)
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
    select: { id: true, nom: true, prenom: true },
  });
  if (!patient) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rdvs = await this.prisma.rendezVous.findMany({
    where: {
      medecinId,
      typeSlot: 'PRIS',
      date: { gte: today },
    },
    // ⚠️ pas besoin d’inclure proche: on ne doit pas matcher dessus
  });

  for (const rdv of rdvs) {
    if (!rdv.date || !rdv.heure) continue;

    const [h, m] = rdv.heure.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) continue;

    const full = new Date(rdv.date);
    full.setHours(h, m, 0, 0);
    if (full < now) continue;

    // ✅ 1) lien direct patient uniquement
    if (rdv.patientId === patient.id) return true;

    // ✅ 2) identité JSON legacy (si un RDV existe sans patientId)
    const identity = rdv.patientIdentity as { nom?: string; prenom?: string } | null;
    if (
      identity?.nom &&
      identity?.prenom &&
      this.normalize(identity.nom) === this.normalize(patient.nom) &&
      this.normalize(identity.prenom) === this.normalize(patient.prenom)
    ) {
      return true;
    }

    // ❌ jamais de match via rdv.proche / patient owner
  }

  return false;
}




async procheHasFutureRdvWithMedecin(
  procheId: number,
  medecinId: number,
): Promise<boolean> {
  const now = new Date();

  const proche = await this.prisma.proche.findUnique({
    where: { id: procheId },
    select: { id: true, nom: true, prenom: true },
  });
  if (!proche) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rdvs = await this.prisma.rendezVous.findMany({
    where: {
      medecinId,
      typeSlot: 'PRIS',
      date: { gte: today },
      procheId: proche.id, // ✅ filtre DB direct
    },
  });

  for (const rdv of rdvs) {
    if (!rdv.date || !rdv.heure) continue;

    const [h, m] = rdv.heure.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) continue;

    const full = new Date(rdv.date);
    full.setHours(h, m, 0, 0);
    if (full >= now) return true;
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
    dto.typeSlot !== undefined
      ? this.normalizeTypeSlot(dto.typeSlot)
      : undefined;

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

  // XOR strict
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
    medecinId:
      dto.medecinId !== undefined ? Number(dto.medecinId) : undefined,
    typeSlot: nextTypeSlot,
    typeConsultation:
      dto.typeConsultation !== undefined
        ? this.normalizeConsultationType(dto.typeConsultation)
        : undefined,
  };

  /**
   * 🔥 RÈGLE MÉTIER FONDAMENTALE
   *
   * 1) PRIS -> LIBRE | BLOQUE | HORS  => reset TOTAL
   * 2) PRIS -> PRIS avec changement patient/proche => reset TOTAL
   */
  const isLeavingPris =
    before.typeSlot === 'PRIS' &&
    nextTypeSlot !== undefined &&
    nextTypeSlot !== 'PRIS';

  const isReplacingPatientInPris =
    before.typeSlot === 'PRIS' &&
    nextTypeSlot === 'PRIS' &&
    (dto.patientId !== undefined || dto.procheId !== undefined);

  if (isLeavingPris || isReplacingPatientInPris) {
    dataPatch.patientId = null;
    dataPatch.procheId = null;
    dataPatch.motif = null;
    dataPatch.patientIdentity = null;
    dataPatch.formulaireDemande = false;
  }

  // Validation finale : PRIS doit avoir une cible
  if (nextTypeSlot === 'PRIS') {
    const afterPatientId =
      dataPatch.patientId !== undefined
        ? dataPatch.patientId
        : before.patientId;

    const afterProcheId =
      dataPatch.procheId !== undefined
        ? dataPatch.procheId
        : before.procheId;

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

  if (dto.formulaireDemande !== undefined) {
    dataPatch.formulaireDemande = dto.formulaireDemande;
  }

  // 🔥 FIX FONDAMENTAL : héritage date / heure AVANT replace
  const finalDate =
    dataPatch.date !== undefined ? dataPatch.date : rdv.date;
  const finalHeure =
    dataPatch.heure !== undefined ? dataPatch.heure : rdv.heure;

  if (nextTypeSlot === 'PRIS') {
    if (!finalDate || !finalHeure) {
      throw new BadRequestException(
        'Impossible de passer un RDV en PRIS sans date et heure.',
      );
    }
  }

  const override: Partial<CreateRdvDto> = {
    ...(dataPatch.medecinId != null ? { medecinId: dataPatch.medecinId } : {}),
    ...(finalDate
      ? {
          date: this.toDateOnlyUTC(new Date(finalDate))
            .toISOString()
            .slice(0, 10),
        }
      : {}),
    ...(finalHeure ? { heure: finalHeure } : {}),
    ...(dataPatch.motif !== undefined ? { motif: dataPatch.motif } : {}),
    ...(dataPatch.patientId !== undefined
      ? { patientId: dataPatch.patientId }
      : {}),
    ...(dataPatch.procheId !== undefined
      ? { procheId: dataPatch.procheId }
      : {}),
    ...(dataPatch.typeSlot !== undefined
      ? { typeSlot: dataPatch.typeSlot }
      : {}),
    ...(dataPatch.typeConsultation !== undefined
      ? { typeConsultation: dataPatch.typeConsultation }
      : {}),
    ...(dataPatch.formulaireDemande !== undefined
      ? { formulaireDemande: dataPatch.formulaireDemande }
      : {}),
  };

  const result = await this.prisma.$transaction(async (tx) => {
    await this.formulaireService.deleteForRdv(rdvId).catch(() => {});
    return this.replaceRdvByDeleteCreate({
      tx,
      sourceId: rdvId,
      override,
    });
  });

  const created = result.created;

  if (rdv.typeSlot === 'PRIS' && nextTypeSlot !== 'PRIS') {
    await this.notificationService.notifyRdvAnnulation(rdvId, actor);
  }

  if (rdv.typeSlot !== 'PRIS' && nextTypeSlot === 'PRIS') {
    await this.notificationService.notifyRdvConfirmation(created.id, actor);
  }

  if (rdv.typeSlot === 'PRIS' && nextTypeSlot === 'PRIS') {
    await this.notificationService.notifyRdvModification(created.id, actor);
  }

  return { success: true, rdv: created };
}

async getDaySchedule(medecinId: number, dateStr: string) {
  if (!medecinId || !dateStr) {
    throw new BadRequestException('Paramètres manquants.');
  }

  const dayStart = new Date(dateStr);
  if (isNaN(dayStart.getTime())) {
    throw new BadRequestException('Date invalide.');
  }

  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);

  // grille complète 07:00 → 23:00
  const slots = this.generateDaySlots();

  const rdvs = await this.prisma.rendezVous.findMany({
    where: {
      medecinId,
      date: {
        gte: dayStart,
        lte: dayEnd,
      },
    },
    include: {
      patient: true,
      proche: true,
    },
  });

  const byHour = new Map<string, any>();
  for (const rdv of rdvs) {
    if (rdv.heure) {
      byHour.set(rdv.heure, rdv);
    }
  }

  return {
    slots: slots.map((hour) => {
      const rdv = byHour.get(hour);

      if (!rdv) {
        return {
          heure: hour,
          typeSlot: 'LIBRE',
          rdvId: null,
          source: 'VIRTUEL',
        };
      }

      return {
        heure: hour,
        typeSlot: this.normalizeTypeSlot(rdv.typeSlot),
        rdvId: rdv.id,
        source: 'REAL',
        patient: rdv.patient
          ? {
              id: rdv.patient.id,
              nom: rdv.patient.nom,
              prenom: rdv.patient.prenom,
            }
          : null,
        proche: rdv.proche
          ? {
              id: rdv.proche.id,
              nom: rdv.proche.nom,
              prenom: rdv.proche.prenom,
            }
          : null,
        motif: rdv.motif ?? null,
        typeConsultation: rdv.typeConsultation ?? null,
      };
    }),
  };
}





async findAll(
  medecinId?: number,
  patientId?: number,
  procheId?: number,
) {
  // ⛔ XOR strict
  if (patientId && procheId) {
    throw new BadRequestException(
      'patientId et procheId ne peuvent pas être définis ensemble.',
    );
  }

  // 🔹 Chargement éventuel du proche (OBLIGATOIRE pour legacy)
  const proche =
    procheId != null
      ? await this.prisma.proche.findUnique({
          where: { id: procheId },
          select: {
            id: true,
            nom: true,
            prenom: true,
          },
        })
      : null;

  // 🔹 Requête DB LARGE (ne jamais perdre un RDV)
  const rdvs = await this.prisma.rendezVous.findMany({
    where: {
      ...(medecinId ? { medecinId } : {}),
      ...(patientId ? { patientId } : {}),
      // ⚠️ PAS de filtre procheId ici (sinon on casse le legacy)
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

  // 🔹 FILTRAGE MÉTIER FINAL (SOURCE DE VÉRITÉ)
  return rdvs.filter((rdv) => {
    // 🧑 PATIENT (rien ne change)
    if (patientId) {
      return rdv.patientId === patientId;
    }

    // 👪 PROCHE (FIX DÉFINITIF)
    if (procheId && proche) {
      return this.rdvMatchesProcheIdentity(rdv, proche);
    }

    // 🩺 MÉDECIN seul → tout
    return true;
  });
}



async canBook(
  medecinId: number,
  patientId?: number,
  procheId?: number,
): Promise<
  | { canBook: true }
  | { canBook: false; reason: 'HAS_FUTURE_RDV' | 'CSV_GATE' }
> {
  // ───────────────────────────────────────────
  // 0️⃣ XOR STRICT
  // ───────────────────────────────────────────
  if (patientId && procheId) {
    throw new BadRequestException(
      'patientId et procheId ne peuvent pas être définis ensemble.',
    );
  }

  // ───────────────────────────────────────────
  // 1️⃣ Médecin
  // ───────────────────────────────────────────
  const medecin = await this.prisma.medecin.findUnique({
    where: { id: medecinId },
    select: {
      id: true,
      accepteNouveauxPatients: true,
    },
  });

  if (!medecin) {
    throw new NotFoundException('Médecin introuvable.');
  }

  // ───────────────────────────────────────────
  // 2️⃣ CSV GATE
  // ───────────────────────────────────────────
  if (medecin.accepteNouveauxPatients === false) {
    const identity = await this.getIdentityForBooking(
      patientId ?? null,
      procheId ?? null,
    );

    await this.assertPatientAllowedForMedecin(medecinId, identity);
  }

  // ───────────────────────────────────────────
  // 3️⃣ RÈGLE MÉTIER — 1 RDV FUTUR MAX
  // ───────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const now = new Date();

  // 🔥 IMPORTANT : PAS DE FILTRE patientId / procheId ICI
  const rdvs = await this.prisma.rendezVous.findMany({
    where: {
      medecinId,
      typeSlot: 'PRIS',
      date: { gte: today },
    },
    select: {
      id: true,
      date: true,
      heure: true,
      patientId: true,
      procheId: true,
      patientIdentity: true,
    },
  });

  // ───────────────────────────────────────────
  // 4️⃣ CAS PATIENT
  // ───────────────────────────────────────────
  if (patientId && !procheId) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, nom: true, prenom: true },
    });
    if (!patient) return { canBook: true };

    for (const rdv of rdvs) {
      if (!rdv.date || !rdv.heure) continue;

      const [h, m] = rdv.heure.split(':').map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) continue;

      const full = new Date(rdv.date);
      full.setHours(h, m, 0, 0);
      if (full < now) continue;

      // lien direct
      if (rdv.patientId === patient.id) {
        return { canBook: false, reason: 'HAS_FUTURE_RDV' };
      }

      // identité legacy
      if (rdv.patientIdentity) {
        const id = rdv.patientIdentity as any;
        if (
          this.normalize(id.nom) === this.normalize(patient.nom) &&
          this.normalize(id.prenom) === this.normalize(patient.prenom)
        ) {
          return { canBook: false, reason: 'HAS_FUTURE_RDV' };
        }
      }
    }

    return { canBook: true };
  }

  // ───────────────────────────────────────────
  // 5️⃣ CAS PROCHE (FIX CRITIQUE)
  // ───────────────────────────────────────────
  if (procheId) {
    const proche = await this.prisma.proche.findUnique({
      where: { id: procheId },
      select: { id: true, nom: true, prenom: true, dateNaissance: true },
    });
    if (!proche) return { canBook: true };

    for (const rdv of rdvs) {
      if (!rdv.date || !rdv.heure) continue;

      const [h, m] = rdv.heure.split(':').map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) continue;

      const full = new Date(rdv.date);
      full.setHours(h, m, 0, 0);
      if (full < now) continue;

      // 1️⃣ lien direct procheId
      if (rdv.procheId === proche.id) {
        return { canBook: false, reason: 'HAS_FUTURE_RDV' };
      }

      // 2️⃣ 🔥 identité legacy (RDV créé par médecin / secrétaire)
      if (rdv.patientIdentity) {
        const id = rdv.patientIdentity as any;
        if (
          this.normalize(id.nom) === this.normalize(proche.nom) &&
          this.normalize(id.prenom) === this.normalize(proche.prenom)
        ) {
          return { canBook: false, reason: 'HAS_FUTURE_RDV' };
        }
      }
    }

    return { canBook: true };
  }

  // ───────────────────────────────────────────
  // 6️⃣ Défaut
  // ───────────────────────────────────────────
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

  if (actor === 'medecin' && first.medecinId !== second.medecinId) {
    throw new BadRequestException('Swap interdit hors planning médecin.');
  }

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

  const posA: Partial<CreateRdvDto> = {
    date: this.toDateOnlyUTC(new Date(first.date)).toISOString().slice(0, 10),
    heure: first.heure,
    ...(first.medecinId != null ? { medecinId: first.medecinId } : {}),
  };

  const posB: Partial<CreateRdvDto> = {
    date: this.toDateOnlyUTC(new Date(second.date)).toISOString().slice(0, 10),
    heure: second.heure,
    ...(second.medecinId != null ? { medecinId: second.medecinId } : {}),
  };

  await this.prisma.$transaction(async (tx) => {
    await this.replaceRdvByDeleteCreate({
      tx,
      sourceId: firstId,
      override: posB,
    });

    await this.replaceRdvByDeleteCreate({
      tx,
      sourceId: secondId,
      override: posA,
    });
  });

  return { success: true };
}



async getForPatient(patientId: number, type: 'futurs' | 'passes') {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1️⃣ Patient + proches (pour legacy uniquement)
  const patient = await this.prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      nom: true,
      prenom: true,
      proches: {
        select: {
          id: true,
          nom: true,
          prenom: true,
        },
      },
    },
  });

  if (!patient) return [];

  const normalize = (v?: string) =>
    (v ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  // 2️⃣ Requête DB large mais contrôlée
  const rdvs = await this.prisma.rendezVous.findMany({
    where: {
      typeSlot: 'PRIS',
      AND: [
        {
          OR: [
            // RDV patient direct
            { patientId },

            // RDV proche réel
            { proche: { patientId } },

            // RDV legacy (CSV / médecin / secrétaire)
            {
              AND: [
                { patientId: null },
                { procheId: null },
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

  // 3️⃣ FILTRAGE FINAL — LOGIQUE MÉTIER CORRECTE
  return rdvs.filter((rdv) => {
    // ✅ RDV patient direct
    if (rdv.patientId === patient.id) {
      return true;
    }

    // ✅ RDV proche RÉEL → PRIORITAIRE (FIX CRITIQUE)
    if (rdv.procheId && rdv.proche?.patientId === patient.id) {
      return true;
    }

    // ⚠️ RDV legacy UNIQUEMENT (pas de patientId, pas de procheId)
    if (!rdv.patientId && !rdv.procheId && rdv.patientIdentity) {
      const id = rdv.patientIdentity as any;
      const idNom = normalize(id.nom);
      const idPrenom = normalize(id.prenom);

      // legacy patient
      if (
        idNom === normalize(patient.nom) &&
        idPrenom === normalize(patient.prenom)
      ) {
        return true;
      }

      // legacy proche
      for (const p of patient.proches ?? []) {
        if (
          idNom === normalize(p.nom) &&
          idPrenom === normalize(p.prenom)
        ) {
          return true;
        }
      }
    }

    return false;
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
  if (existing) {
    const created = await this.prisma.$transaction(async (tx) => {
      await this.formulaireService.deleteForRdv(existing.id).catch(() => {});
      await tx.rendezVous.delete({ where: { id: existing.id } });

      return tx.rendezVous.create({
        data: {
          medecinId,
          date: dateObj,
          heure: data.heure,
          typeSlot: targetType,
          patientId: null,
          procheId: null,
          motif: null,
          patientIdentity: undefined as any,
          typeConsultation: 'PRESENTIEL',
          formulaireDemande: false,
        },
        include: {
          patient: true,
          proche: true,
          medecin: true,
        },
      });
    });

    return { success: true, rdv: created };
  }

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
  typeSlot?: 'LIBRE' | 'BLOQUE';
  deleteOnly?: boolean;
}) {
  const { medecinId, date, start, end, typeSlot, deleteOnly } = params;

  if (!medecinId || !date || !start || !end) {
    throw new BadRequestException('Paramètres incomplets.');
  }

  const dateObj = new Date(`${date}T00:00:00.000Z`);
  if (isNaN(dateObj.getTime())) {
    throw new BadRequestException('Date invalide.');
  }

  const heures = this.splitInterval(start, end);

  return this.prisma.$transaction(async (tx) => {
    // 1️⃣ DELETE HARD — vérité absolue
    await tx.rendezVous.deleteMany({
      where: {
        medecinId,
        date: dateObj,
        heure: { in: heures },
      },
    });

    // 2️⃣ VIERGE = delete only
    if (deleteOnly === true) {
      return { success: true, deleted: heures.length };
    }

    // 3️⃣ Création contrôlée (LIBRE ou BLOQUE)
    const finalType = this.normalizeTypeSlot(typeSlot ?? 'LIBRE');

    if (finalType !== 'LIBRE' && finalType !== 'BLOQUE') {
      throw new BadRequestException('typeSlot invalide pour un créneau.');
    }

    for (const heure of heures) {
      await tx.rendezVous.create({
        data: {
          medecinId,
          date: dateObj,
          heure,
          typeSlot: finalType,
          patientId: null,
          procheId: null,
          patientIdentity: Prisma.JsonNull,
          motif: null,
          formulaireDemande: false,
          typeConsultation: 'PRESENTIEL',
        },
      });
    }

    return { success: true, created: heures.length, typeSlot: finalType };
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

  if (!dto.date) {
    throw new BadRequestException('Date obligatoire.');
  }

  const rawDate = new Date(dto.date);
  if (isNaN(rawDate.getTime())) {
    throw new BadRequestException('Date invalide.');
  }

  const date = new Date(rawDate);
  date.setHours(0, 0, 0, 0);

  if (!dto.heure) {
    throw new BadRequestException('Heure obligatoire.');
  }

  const typeSlot =
    dto.typeSlot
      ? this.normalizeTypeSlot(dto.typeSlot)
      : dto.patientId || dto.procheId
      ? 'PRIS'
      : 'LIBRE';

  // 🔒 GARDE-FOU ABSOLU
  if (typeSlot === 'PRIS' && (!dto.date || !dto.heure)) {
    throw new BadRequestException(
      'Un rendez-vous PRIS doit obligatoirement avoir une date et une heure.',
    );
  }

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

  const formulaireDemande = dto.formulaireDemande === true;

  const rdv = await this.prisma.rendezVous.create({
    data: {
      medecinId,
      date,
      heure: dto.heure,
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
  // CAS 3 : slot LIBRE → delete + create (immutabilité)
  // --------------------------------------------------
  const rdv = await this.prisma.$transaction(async (tx) => {
    // slot LIBRE existant supprimé
    await tx.rendezVous.delete({ where: { id: slot.id } });

    // nouveau RDV PRIS créé (nouvel id)
    return tx.rendezVous.create({
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
  });

  await this.notificationService.notifyRdvConfirmation(rdv.id, 'patient');

  if (patientId) {
    await this.formulaireService.createForRdv(rdv.id, patientId, medecinId);

    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { email: true },
    });

    if (patient?.email) {
      await this.formulaireService.sendFormulaireEmail(patient.email, rdv.id);
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

  const dateOnly = this.toDateOnlyUTC(targetDate).toISOString().slice(0, 10);

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

    // 🔒 collision réelle uniquement
    const collision = await tx.rendezVous.findFirst({
      where: {
        medecinId,
        date: this.toDateOnlyUTC(targetDate),
        heure: toHour,
      },
    });

    if (collision) {
      throw new BadRequestException(
        'Un autre rendez-vous existe déjà sur ce créneau.',
      );
    }

    const { created } = await this.replaceRdvByDeleteCreate({
      tx,
      sourceId: rdvId,
      override: {
        date: dateOnly,
        heure: toHour,
      },
    });

    if (source.typeSlot === 'PRIS') {
      await this.notificationService.notifyRdvModification(
        created.id,
        'medecin',
      );
    }

    return { success: true, rdv: created };
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
  });

  if (!rdv) {
    throw new NotFoundException('RDV introuvable.');
  }

  if (rdv.typeSlot === 'PRIS') {
    await this.notificationService.notifyRdvAnnulation(id, actor);
  }

  const targetType: 'LIBRE' = 'LIBRE';

  const created = await this.prisma.$transaction(async (tx) => {
    await this.deleteRdvCascade(tx, id);

return tx.rendezVous.create({
  data: {
    medecinId: rdv.medecinId!,
    date: rdv.date,
    heure: rdv.heure,
    typeSlot: 'LIBRE',
    patientId: null,
    procheId: null,
    patientIdentity: Prisma.JsonNull, // ✅ FIX
    motif: null,
    formulaireDemande: false,
    typeConsultation: rdv.typeConsultation,
  },
});

  });

  return { success: true, rdv: created };
}



async deleteHard(rdvId: number) {
  const rdv = await this.prisma.rendezVous.findUnique({
    where: { id: rdvId },
  });

  if (!rdv) {
    throw new NotFoundException('RDV introuvable.');
  }

  await this.prisma.$transaction(async (tx) => {
    // ✅ DELETE CASCADE (FIX)
    await this.deleteRdvCascade(tx, rdvId);
  });

  return { success: true };
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

  // ⛔ XOR
  if (patientId && procheId) {
    throw new BadRequestException(
      'patientId et procheId ne peuvent pas être définis ensemble.',
    );
  }

  // 🔒 règle RDV futur
  if (patientId) {
    const hasFuture = await this.patientHasFutureRdvWithMedecin(
      patientId,
      medecinId,
    );
    if (hasFuture) return [];
  }

  if (procheId) {
    const hasFuture = await this.procheHasFutureRdvWithMedecin(
      procheId,
      medecinId,
    );
    if (hasFuture) return [];
  }

  // 🔒 CSV gate
  if (patientId || procheId) {
    const identity = await this.getIdentityForBooking(
      patientId ?? null,
      procheId ?? null,
    );
    await this.assertPatientAllowedForMedecin(medecinId, identity);
  }

  // ✅ FIX FUSEAU — DATE LOCALE
  const dayStart = new Date(dateStr);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(dateStr);
  dayEnd.setHours(23, 59, 59, 999);

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
  if (!dto.date || !dto.heure) {
    throw new BadRequestException('date et heure obligatoires.');
  }

  const rawDate = new Date(dto.date);
  if (isNaN(rawDate.getTime())) {
    throw new BadRequestException('Date invalide.');
  }

  const date = this.toDateOnlyUTC(rawDate);
  const heure = dto.heure;

  const medecinId = Number(dto.medecinId);
  if (!medecinId || isNaN(medecinId)) {
    throw new BadRequestException('medecinId invalide.');
  }

  const requestedTypeSlot = dto.typeSlot
    ? this.normalizeTypeSlot(dto.typeSlot)
    : 'PRIS';

  return this.prisma.$transaction(async (tx) => {
    // 🔥 DELETE HARD de tout ce qui existe sur ce créneau
    const existing = await tx.rendezVous.findFirst({
      where: { medecinId, date, heure },
    });

    if (existing) {
      await this.formulaireService.deleteForRdv(existing.id).catch(() => {});
      await tx.rendezVous.delete({ where: { id: existing.id } });
    }

    // =====================================================
    // ✅ CAS 1 — SLOT LIBRE
    // =====================================================
    if (requestedTypeSlot === 'LIBRE') {
      const created = await tx.rendezVous.create({
        data: {
          medecinId,
          date,
          heure,
          typeSlot: 'LIBRE',
          patientId: null,
          procheId: null,
          patientIdentity: undefined,
          motif: null,
          formulaireDemande: false,
          // ⛔ PAS de typeConsultation ici
        },
        include: {
          patient: true,
          proche: true,
          medecin: true,
        },
      });

      return { success: true, rdv: created };
    }

    // =====================================================
    // ✅ CAS 2 — SLOT BLOQUÉ
    // =====================================================
    if (requestedTypeSlot === 'BLOQUE') {
      const created = await tx.rendezVous.create({
        data: {
          medecinId,
          date,
          heure,
          typeSlot: 'BLOQUE',
          patientId: null,
          procheId: null,
          patientIdentity: undefined,
          motif: null,
          formulaireDemande: false,
          // ⛔ PAS de typeConsultation ici
        },
        include: {
          patient: true,
          proche: true,
          medecin: true,
        },
      });

      return { success: true, rdv: created };
    }

    // =====================================================
    // 🔴 CAS 3 — RDV PRIS
    // =====================================================
    if (requestedTypeSlot === 'PRIS') {
      const patientId =
        dto.patientId !== undefined && dto.patientId !== null
          ? Number(dto.patientId)
          : null;

      const procheId =
        dto.procheId !== undefined && dto.procheId !== null
          ? Number(dto.procheId)
          : null;

      if (!patientId && !procheId && !dto.patientIdentity) {
        throw new BadRequestException(
          'Un RDV PRIS nécessite un patient ou une identité.',
        );
      }

      const typeConsultation = this.normalizeConsultationType(
        dto.typeConsultation ?? 'PRESENTIEL',
      );

      const created = await tx.rendezVous.create({
        data: {
          medecinId,
          date,
          heure,
          typeSlot: 'PRIS',
          typeConsultation,
          patientId,
          procheId,
          patientIdentity: dto.patientIdentity
            ? (dto.patientIdentity as any)
            : undefined,
          motif: dto.motif ?? null,
          formulaireDemande: dto.formulaireDemande === true,
        },
        include: {
          patient: true,
          proche: true,
          medecin: true,
        },
      });

      return { success: true, rdv: created };
    }

    // =====================================================
    // ⛔ GARDE ABSOLUE
    // =====================================================
    throw new BadRequestException('typeSlot non supporté.');
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
  if (isNaN(destMedecinId)) {
    throw new BadRequestException('toMedecinId invalide.');
  }

  const dateOnly = this.toDateOnlyUTC(targetDate)
    .toISOString()
    .slice(0, 10);

  return this.prisma.$transaction(async (tx) => {
    const source = await tx.rendezVous.findUnique({
      where: { id: rdvId },
      include: { patient: true, proche: true, medecin: true },
    });

    if (!source) {
      throw new NotFoundException('RDV introuvable.');
    }

    if (source.medecinId == null) {
      throw new BadRequestException('medecinId source manquant.');
    }

    // 🔒 secrétaire : inter-médecins autorisé uniquement si même cabinet
    if (source.medecinId !== destMedecinId) {
      const [m1, m2] = await Promise.all([
        tx.medecin.findUnique({
          where: { id: source.medecinId },
          select: { cabinetId: true },
        }),
        tx.medecin.findUnique({
          where: { id: destMedecinId },
          select: { cabinetId: true },
        }),
      ]);

      if (!m1 || !m2) {
        throw new NotFoundException('Médecin introuvable.');
      }

      if (!m1.cabinetId || !m2.cabinetId || m1.cabinetId !== m2.cabinetId) {
        throw new BadRequestException(
          'Impossible de déplacer un RDV entre médecins de cabinets différents.',
        );
      }
    }

    // 🚫 collision sur le créneau cible
    const collision = await tx.rendezVous.findFirst({
      where: {
        medecinId: destMedecinId,
        date: this.toDateOnlyUTC(targetDate),
        heure: toHour,
      },
      select: { id: true },
    });

    if (collision) {
      throw new BadRequestException(
        'Un autre rendez-vous existe déjà sur ce créneau.',
      );
    }

    // ✅ IMMUTABILITÉ : DELETE + CREATE
    const { created } = await this.replaceRdvByDeleteCreate({
      tx,
      sourceId: rdvId,
      override: {
        date: dateOnly,
        heure: toHour,
        medecinId: destMedecinId,
      },
    });

    // 🔔 notif si RDV PRIS
    if (source.typeSlot === 'PRIS') {
      await this.notificationService.notifyRdvModification(
        created.id,
        'secretaire',
      );
    }

    return { success: true, rdv: created };
  });
}


async getMedecinPlanningMeta(medecinId: number) {
  const medecin = await this.prisma.medecin.findUnique({
    where: { id: medecinId },
    select: {
      id: true,
      horaires: true,
    },
  });

  if (!medecin) {
    throw new BadRequestException('Médecin introuvable.');
  }

  return {
    medecinId: medecin.id,
    horaires:
      typeof medecin.horaires === 'string'
        ? JSON.parse(medecin.horaires)
        : medecin.horaires,
  };
}

}
