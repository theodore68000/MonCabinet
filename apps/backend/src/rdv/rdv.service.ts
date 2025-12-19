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


  async canBook(medecinId: number, patientId?: number, procheId?: number) {
  const identity = await this.getIdentityForBooking(
    patientId ?? null,
    procheId ?? null,
  );
  await this.assertPatientAllowedForMedecin(medecinId, identity);
  return { allowed: true };
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
    actor: 'medecin' | 'secretaire' = 'secretaire',
  ) {
    const first = await this.prisma.rendezVous.findUnique({
      where: { id: firstId },
      include: { patient: true, proche: true, medecin: true },
    });

    const second = await this.prisma.rendezVous.findUnique({
      where: { id: secondId },
      include: { patient: true, proche: true, medecin: true },
    });

    if (!first || !second) {
      throw new NotFoundException('RDV introuvable.');
    }

    const sameMedecin = first.medecinId === second.medecinId;

    // Médecin: jamais inter-médecins
    if (actor === 'medecin' && !sameMedecin) {
      throw new BadRequestException(
        'Impossible de permuter des RDV de médecins différents.',
      );
    }

    // Secrétaire: inter-médecins autorisé seulement si cabinet commun
    if (actor === 'secretaire' && !sameMedecin) {

      if (!first.medecinId || !second.medecinId) {
  throw new BadRequestException(
    'Impossible de permuter un RDV sans médecin associé.',
  );
}

const [m1, m2] = await Promise.all([
  this.prisma.medecin.findUnique({
    where: { id: first.medecinId },
    select: { id: true, cabinetId: true },
  }),
  this.prisma.medecin.findUnique({
    where: { id: second.medecinId },
    select: { id: true, cabinetId: true },
  }),
]);


      if (!m1 || !m2) throw new NotFoundException('Médecin introuvable.');

      if (!m1.cabinetId || !m2.cabinetId || m1.cabinetId !== m2.cabinetId) {
        throw new BadRequestException(
          'Impossible de permuter des RDV entre médecins de cabinets différents.',
        );
      }
    }

    // Slot A et slot B
    const firstSlot = { date: first.date, heure: first.heure, medecinId: first.medecinId };
    const secondSlot = { date: second.date, heure: second.heure, medecinId: second.medecinId };

    // Cible après swap
    // - first va sur le slot de second (date/heure) + medecinId de second si inter-médecins
    // - second va sur le slot de first (date/heure) + medecinId de first si inter-médecins
    const targetForFirst = {
      date: secondSlot.date,
      heure: secondSlot.heure,
      medecinId: secondSlot.medecinId,
    };
    const targetForSecond = {
      date: firstSlot.date,
      heure: firstSlot.heure,
      medecinId: firstSlot.medecinId,
    };

    // Contrôle collisions:
    // 1) sur le médecin cible du "first"
    // 2) sur le médecin cible du "second"
    // en excluant firstId + secondId
    const [collision1, collision2] = await Promise.all([
      this.prisma.rendezVous.findFirst({
        where: {
          medecinId: targetForFirst.medecinId,
          date: targetForFirst.date,
          heure: targetForFirst.heure,
          NOT: { id: { in: [firstId, secondId] } },
        },
        select: { id: true },
      }),
      this.prisma.rendezVous.findFirst({
        where: {
          medecinId: targetForSecond.medecinId,
          date: targetForSecond.date,
          heure: targetForSecond.heure,
          NOT: { id: { in: [firstId, secondId] } },
        },
        select: { id: true },
      }),
    ]);

    if (collision1 || collision2) {
      throw new BadRequestException(
        'Un autre rendez-vous existe déjà sur ce créneau.',
      );
    }

    const [updatedFirst, updatedSecond] = await this.prisma.$transaction([
      this.prisma.rendezVous.update({
        where: { id: firstId },
        data: {
          date: targetForFirst.date,
          heure: targetForFirst.heure,
          medecinId: targetForFirst.medecinId,
        },
      }),
      this.prisma.rendezVous.update({
        where: { id: secondId },
        data: {
          date: targetForSecond.date,
          heure: targetForSecond.heure,
          medecinId: targetForSecond.medecinId,
        },
      }),
    ]);

    // Notifications: uniquement si RDV "PRIS" avec patient/proche
    const firstWasPris =
      first.typeSlot === 'PRIS' && (first.patientId !== null || first.procheId !== null);
    const secondWasPris =
      second.typeSlot === 'PRIS' && (second.patientId !== null || second.procheId !== null);

    if (actor === 'secretaire') {
      if (firstWasPris) {
        await this.notificationService.notifyRdvModification(
          updatedFirst.id,
          'secretaire',
        );
      }
      if (secondWasPris) {
        await this.notificationService.notifyRdvModification(
          updatedSecond.id,
          'secretaire',
        );
      }
    } else {
      // Médecin: pas de mail "modification secrétaire" (on garde comportement sobre)
      // Si tu veux mail côté médecin aussi, on peut l’ajouter ensuite.
    }

    return { success: true, first: updatedFirst, second: updatedSecond };
  }

async getForPatient(patientId: number, type: 'futurs' | 'passes') {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM

  return this.prisma.rendezVous.findMany({
    where: {
      typeSlot: 'PRIS',

      AND: [
        {
          OR: [
            // RDV direct patient
            { patientId },

            // RDV pour un proche
            { proche: { patientId } },

            // RDV créé par médecin / secrétaire avec identité stockée
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
                { date: { gt: now } },
                {
                  AND: [
                    { date: now },
                    { heure: { gt: currentTime } },
                  ],
                },
              ],
            }
          : {
              OR: [
                { date: { lt: now } },
                {
                  AND: [
                    { date: now },
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
    const dateObj = new Date(data.date);
    if (isNaN(dateObj.getTime())) throw new BadRequestException('Date invalide.');

    const medecinId = Number(data.medecinId);
    if (!medecinId || isNaN(medecinId)) {
      throw new BadRequestException('medecinId obligatoire pour créer un slot.');
    }

    if (!data.heure) throw new BadRequestException('Heure obligatoire.');

    const typeSlot = this.normalizeTypeSlot(data.typeSlot ?? 'LIBRE');

    const existing = await this.prisma.rendezVous.findFirst({
      where: { medecinId, date: dateObj, heure: data.heure },
    });
    if (existing) throw new BadRequestException('Ce créneau existe déjà.');

    const rdv = await this.prisma.rendezVous.create({
      data: { medecinId, date: dateObj, heure: data.heure, typeSlot },
      include: { patient: true, proche: true, medecin: true },
    });

    return { success: true, rdv };
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

    // 🔎 FIX — rattachement automatique du proche via l’identité (cabinet)
    if (!patientId && !procheId && patientIdentity && dto.patientId) {
      const resolvedProcheId = await this.resolveProcheFromIdentity(
        Number(dto.patientId),
        patientIdentity as any,
      );

      if (resolvedProcheId) {
        procheId = resolvedProcheId;
      }
    }

    if (!patientId && !procheId) {
      throw new BadRequestException(
        'Un rendez-vous PRIS doit être rattaché à un patient ou un proche.',
      );
    }
  }

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
    },
    include: {
      patient: true,
      proche: true,
      medecin: true,
    },
  });

  return rdv;
}



  /* -------------------------------------------------------------
   * Création RDV (patient)
   * ⚠️ NE PAS TOUCHER (exigence projet)
   ------------------------------------------------------------- */
async createForPatient(dto: CreateRdvDto) {
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
  // Existence patient (sécurité)
  // -------------------------------
  await this.assertPatientExists(patientId);

  // -------------------------------
  // 🔒 CSV GATE — RÈGLE MÉTIER CRITIQUE
  // -------------------------------
  const identity = await this.getIdentityForBooking(patientId, procheId);
  await this.assertPatientAllowedForMedecin(medecinId, identity);

  // -------------------------------
  // 1 seul RDV futur par patient/proche
  // -------------------------------
  const existingFuture = await this.prisma.rendezVous.findFirst({
    where: {
      medecinId,
      OR: [
        ...(patientId ? [{ patientId }] : []),
        ...(procheId ? [{ procheId }] : []),
      ],
      typeSlot: 'PRIS',
      date: { gte: new Date() },
    },
  });

  if (existingFuture) {
    throw new BadRequestException(
      'Vous avez déjà un rendez-vous à venir avec ce médecin.',
    );
  }

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

  // ------------------------------------------------------------------
  // CAS 1 : aucun slot existant → création directe
  // ------------------------------------------------------------------
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

    await this.notificationService.notifyRdvConfirmation(rdv.id, 'patient');

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

  // ------------------------------------------------------------------
  // CAS 2 : slot existant mais non libre
  // ------------------------------------------------------------------
  if (slot.typeSlot !== 'LIBRE') {
    throw new BadRequestException('Créneau non disponible.');
  }

  // ------------------------------------------------------------------
  // CAS 3 : slot LIBRE → mise à jour
  // ------------------------------------------------------------------
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

  await this.notificationService.notifyRdvConfirmation(rdv.id, 'patient');

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
      throw new NotFoundException('RDV source introuvable.');
    }

    if (source.medecinId !== medecinId) {
      throw new ForbiddenException(
        'Impossible de déplacer un RDV hors de votre planning.',
      );
    }

    // 🔒 collision cible
    const collision = await tx.rendezVous.findFirst({
      where: {
        medecinId,
        date: targetDate,
        heure: toHour,
      },
      select: { id: true },
    });

    if (collision) {
      throw new BadRequestException(
        'Un autre rendez-vous existe déjà sur ce créneau.',
      );
    }

    // ✅ CLONE STRICT DU RDV SOURCE
    const created = await tx.rendezVous.create({
      data: {
        medecinId: source.medecinId,
        date: targetDate,
        heure: toHour,

        typeSlot: source.typeSlot,
        typeConsultation: source.typeConsultation,
        motif: source.motif,

        patientId: source.patientId,
        procheId: source.procheId,

        // 🔑 LA LIGNE QUI MANQUAIT
patientIdentity: source.patientIdentity as Prisma.InputJsonValue,


        visioRoomName: source.visioRoomName,
        statutVisio: source.statutVisio,
        rappelEnvoye: source.rappelEnvoye,
      },
    });

    // suppression de l'ancien RDV
    await tx.rendezVous.delete({
      where: { id: rdvId },
    });

    // notifications si RDV PRIS
    if (source.typeSlot === 'PRIS') {
      this.notificationService.notifyRdvModification(
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

  // -------------------------------------------------
  // 🔒 CSV GATE — AVANT TOUT CALCUL
  // -------------------------------------------------
  if (patientId || procheId) {
    const identity = await this.getIdentityForBooking(
      patientId ?? null,
      procheId ?? null,
    );

    await this.assertPatientAllowedForMedecin(medecinId, identity);
  }

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(date);
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
    const t = this.normalizeTypeSlot(r.typeSlot);
    if (t !== 'LIBRE') {
      unavailable.add(r.heure);
    }
  });

  const libres = rdvs
    .filter((r) => this.normalizeTypeSlot(r.typeSlot) === 'LIBRE')
    .map((r) => r.heure);

  const uniqueSlots = Array.from(new Set(libres)).sort();

  return uniqueSlots.filter((h) => {
    if (unavailable.has(h)) return false;

    const [HH, MM] = h.split(':').map(Number);
    const slotDate = new Date(dateStr);
    slotDate.setHours(HH, MM, 0, 0);

    return slotDate > new Date();
  });
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
          date: {
            gte: new Date(dateStr + 'T00:00:00.000Z'),
            lte: new Date(dateStr + 'T23:59:59.999Z'),
          },
        },
      },
    },
  });

  // 2️⃣ RDV réels du jour pour tout le cabinet
  const rdvs = await this.prisma.rendezVous.findMany({
    where: {
      medecin: { cabinetId },
      date: {
        gte: new Date(dateStr + 'T00:00:00.000Z'),
        lte: new Date(dateStr + 'T23:59:59.999Z'),
      },
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
    const key = `${rdv.medecinId}_${rdv.heure}`;
    rdvByMedecinAndHour.set(key, rdv);
  }

  // Générateur heures fixes (07:00 → 23:00 par 15min, adapte si besoin)
  const hours: string[] = [];
  for (let h = 7; h < 23; h++) {
    for (let m = 0; m < 60; m += 15) {
      hours.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }

  // Helper horaires (référence + exception)
  const getHorairesForDay = (med: any): string[] => {
    const exception = med.horairesExceptionnels?.[0]?.horaires;
    if (exception) {
      return Array.isArray(exception) ? exception : [];
    }

    const base =
      med.horairesReference ||
      med.horaires ||
      {};

    const dayKey = date
      .toLocaleDateString('fr-FR', { weekday: 'long' })
      .toLowerCase();

    return base?.[dayKey] || [];
  };

  // 3️⃣ Construction planning final
  const medecinsPlanning = medecins.map((med) => {
    const plages = getHorairesForDay(med);

    const isInHoraires = (heure: string) => {
      const [h, m] = heure.split(':').map(Number);
      const minutes = h * 60 + m;

      return plages.some((p) => {
        const [start, end] = p.split('-');
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        return (
          minutes >= sh * 60 + sm &&
          minutes < eh * 60 + em
        );
      });
    };

    const slots = hours.map((heure) => {
      const key = `${med.id}_${heure}`;
      const rdv = rdvByMedecinAndHour.get(key);

      // 🟢 SLOT RÉEL
      if (rdv) {
        return {
          heure,
          typeSlot: rdv.typeSlot,
          isVirtual: false,
          rdvId: rdv.id,
          patient: rdv.patient,
          proche: rdv.proche,
          motif: rdv.motif,
          typeConsultation: rdv.typeConsultation,
        };
      }

      // 🔵 SLOT VIRTUEL
      if (isInHoraires(heure)) {
        return {
          heure,
          typeSlot: 'LIBRE',
          isVirtual: true,
          rdvId: null,
        };
      }

      // ⚫ HORS HORAIRES
      return {
        heure,
        typeSlot: 'HORS',
        isVirtual: true,
        rdvId: null,
      };
    });

    return {
      id: med.id,
      nom: med.nom,
      prenom: med.prenom,
      horaires: plages,
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
  const dateObj = new Date(dto.date);
  if (isNaN(dateObj.getTime())) throw new BadRequestException('Date invalide.');
  if (!dto.heure) throw new BadRequestException('Heure obligatoire.');

  const medecinId = Number(dto.medecinId);
  if (!medecinId || isNaN(medecinId)) {
    throw new BadRequestException('ID médecin invalide.');
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

  if (dto.patientIdentity?.source === 'CSV') {
    const { nom, prenom, dateNaissance } = dto.patientIdentity;

    if (!nom || !prenom || !dateNaissance) {
      throw new BadRequestException(
        'Nom, prénom et date de naissance requis pour un patient du médecin (CSV).',
      );
    }

    await this.assertIdentityInCsvForMedecin(medecinId, {
      nom,
      prenom,
      dateNaissance,
    });
  }

  const finalSlot = this.normalizeTypeSlot(dto.typeSlot ?? 'PRIS');
  const typeConsultation = this.normalizeConsultationType(dto.typeConsultation);

  let patientIdentity: Prisma.InputJsonValue | undefined =
    dto.patientIdentity
      ? ({
          source: dto.patientIdentity.source,
          nom: dto.patientIdentity.nom,
          prenom: dto.patientIdentity.prenom,
          dateNaissance: dto.patientIdentity.dateNaissance ?? null,
        } as Prisma.InputJsonValue)
      : undefined;

  // 🔎 FIX — rattachement automatique du proche via identité (upload / CSV)
  if (!patientId && !procheId && patientIdentity && dto.patientId) {
    const resolvedProcheId = await this.resolveProcheFromIdentity(
      Number(dto.patientId),
      patientIdentity as any,
    );

    if (resolvedProcheId) {
      procheId = resolvedProcheId;
    }
  }

  if (finalSlot === 'PRIS') {
    if (!patientId && !procheId && !dto.patientIdentity) {
      throw new BadRequestException(
        "Un RDV PRIS doit avoir patientId, procheId, ou une identité (HORS/CSV).",
      );
    }
  }

  return this.prisma.$transaction(async (tx) => {
    const existing = await tx.rendezVous.findFirst({
      where: { medecinId, date: dateObj, heure: dto.heure },
      select: { id: true, typeSlot: true, patientId: true, procheId: true },
    });

    if (existing) {
      await this.formulaireService.deleteForRdv(existing.id).catch(() => {});

      if (existing.typeSlot === 'PRIS' && (existing.patientId || existing.procheId)) {
        await this.notificationService.notifyRdvModification(existing.id, 'medecin');
      }

      await tx.rendezVous.delete({ where: { id: existing.id } });
    }

    const created = await tx.rendezVous.create({
      data: {
        medecinId,
        date: dateObj,
        heure: dto.heure,
        motif: dto.motif ?? null,
        typeSlot: finalSlot,
        typeConsultation,
        patientId,
        procheId,
        patientIdentity,
      },
      include: { patient: true, proche: true, medecin: true },
    });

    if (finalSlot === 'PRIS') {
      await this.notificationService.notifyRdvConfirmation(created.id, 'medecin');

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


}
