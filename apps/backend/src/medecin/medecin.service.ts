import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateMedecinDto } from './dto/create-medecin.dto';
import { UpdateMedecinDto } from './dto/update-medecin.dto';
import { randomBytes } from "crypto";
import { MailService } from '../mail/mail.service';
import { PasswordService } from '../common/security/password.service';
import * as bcrypt from 'bcrypt';
import { CreateSecretaireDto } from '../secretaire/dto/create-secretaire.dto';

// AJOUT CSV
import { parseCSVPatients } from '../common/csv.utils';
import { identitiesMatch } from '../common/identity.utils';
import { normalize } from "../common/identity.utils";

@Injectable()
export class MedecinService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private passwordService: PasswordService,
  ) {}

  /* -------------------------------------------------------------
   * UTILITAIRE : NORMALISATION HORAIRES
   ------------------------------------------------------------- */
  private normalizeHoraires(input: any) {
    if (input === null || input === undefined) return {};
    if (typeof input === 'object') return input;
    if (typeof input === 'string') {
      try {
        return JSON.parse(input);
      } catch {
        return {};
      }
    }
    return {};
  }

  /* -------------------------------------------------------------
   * CRÉATION MÉDECIN
   ------------------------------------------------------------- */
  async create(data: CreateMedecinDto) {
    const horaires = this.normalizeHoraires(data.horaires);

    const hashedPassword = await this.passwordService.hash(
      data.motDePasse ?? '1234',
    );

    return this.prisma.medecin.create({
      data: {
        nom: data.nom,
        prenom: data.prenom,
        email: data.email,
        motDePasse: hashedPassword,
        telephone: data.telephone,
        specialite: data.specialite,
        adresseCabinet: data.adresseCabinet,
        rpps: data.rpps,
        accepteNouveauxPatients: data.accepteNouveauxPatients ?? true,
        statut: data.statut ?? 'en_attente',
        photoUrl: data.photoUrl,

        horairesReference: horaires,
        horaires: horaires,

        bio: data.bio,
        typeExercice: data.typeExercice,
        siret: data.siret,
        adresseFacturation: data.adresseFacturation,
        cabinetId: data.cabinetId ?? null,
      },
    });
  }

  /* -------------------------------------------------------------
   * LOGIN
   ------------------------------------------------------------- */
  async login(email: string, motDePasse: string) {
    const med = await this.prisma.medecin.findUnique({
      where: { email },
    });

    if (!med)
      return { success: false, message: 'Aucun compte associé à cet email.' };

    if (!med.motDePasse) {
      return { success: false, message: 'Mot de passe non défini.' };
    }

    const valid = await this.passwordService.compare(
      motDePasse,
      med.motDePasse,
    );

    if (!valid) return { success: false, message: 'Mot de passe incorrect.' };

    return { success: true, medecin: med };
  }

  /* -------------------------------------------------------------
   * MOT DE PASSE OUBLIÉ / RESET
   ------------------------------------------------------------- */
async forgotPassword(email: string) {
  const medecin = await this.prisma.medecin.findUnique({
    where: { email },
  });

  // 🔐 Toujours répondre OK (sécurité)
  if (!medecin) {
    return {
      success: true,
      message:
        "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.",
    };
  }

const token = randomBytes(32).toString("hex");


  await this.prisma.medecin.update({
    where: { id: medecin.id },
    data: {
      resetToken: token,
      resetExpires: new Date(Date.now() + 1000 * 60 * 30), // 30 min
    },
  });

  const resetLink =
    `${process.env.FRONT_URL}/medecin/reset-password?token=${token}`;

await this.mailService.send(
  email,
  "Réinitialisation de votre mot de passe",
  `
    <p>Bonjour Dr ${medecin.nom},</p>
    <p>Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe :</p>
    <a href="${resetLink}">${resetLink}</a>
    <p>Ce lien expire dans 30 minutes.</p>
  `
);


  return {
    success: true,
    message:
      "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.",
  };
}


async resetPassword(token: string, motDePasse: string) {
  const medecin = await this.prisma.medecin.findFirst({
    where: {
      resetToken: token,
      resetExpires: {
        gt: new Date(),
      },
    },
  });

  if (!medecin) {
    return {
      success: false,
      message: "Lien invalide ou expiré.",
    };
  }

  const hashedPassword = await bcrypt.hash(motDePasse, 10);

  await this.prisma.medecin.update({
    where: { id: medecin.id },
    data: {
      motDePasse: hashedPassword,
      resetToken: null,
      resetExpires: null,
    },
  });

  return {
    success: true,
    message: "Mot de passe réinitialisé avec succès.",
  };
}

  /* -------------------------------------------------------------
   * LISTE MÉDECINS
   ------------------------------------------------------------- */
  async findAll() {
    const list = await this.prisma.medecin.findMany({
      include: { cabinet: true },
    });

    return list.map((m) => ({
      ...m,
      horairesReference:
        this.normalizeHoraires(m.horairesReference) ??
        this.normalizeHoraires(m.horaires) ??
        {},
      horaires: this.normalizeHoraires(m.horaires) ?? {},
    }));
  }

  /* -------------------------------------------------------------
   * FIND ONE
   ------------------------------------------------------------- */
  async findOne(id: number) {
    return this.prisma.medecin.findUnique({
      where: { id },
      include: {
        cabinet: {
          include: {
            medecins: {
              select: {
                id: true,
                nom: true,
                prenom: true,
                email: true,
                photoUrl: true,
              },
            },
          },
        },
      },
    });
  }

  /* -------------------------------------------------------------
   * UPDATE MÉDECIN
   ------------------------------------------------------------- */
  async update(id: number, data: UpdateMedecinDto) {
    const safeData: any = { ...data };

    if (safeData.motDePasse) {
      safeData.motDePasse = await this.passwordService.hash(
        safeData.motDePasse,
      );
    }

    if ('horaires' in safeData) {
      safeData.horairesReference = this.normalizeHoraires(safeData.horaires);
      delete safeData.horaires;
    }

    if ('horairesReference' in safeData) {
      safeData.horairesReference = this.normalizeHoraires(
        safeData.horairesReference,
      );
    }

    delete safeData.nom;
    delete safeData.prenom;
    delete safeData.rpps;
    delete safeData.cabinetId;

    return this.prisma.medecin.update({
      where: { id },
      data: safeData,
    });
  }

  /* -------------------------------------------------------------
   * REMOVE
   ------------------------------------------------------------- */
  remove(id: number) {
    return this.prisma.medecin.delete({ where: { id } });
  }

  /* -------------------------------------------------------------
   * CHANGEMENT D'ID
   * ✅ FIX IMPORTANT : évite violation unique sur email (@unique)
   ------------------------------------------------------------- */
  async changeId(oldId: number, newId: number) {
    if (oldId === newId)
      throw new BadRequestException('Les ID sont identiques.');

    const med = await this.prisma.medecin.findUnique({ where: { id: oldId } });
    if (!med) throw new NotFoundException('Médecin introuvable.');

    const exist = await this.prisma.medecin.findUnique({ where: { id: newId } });
    if (exist) throw new BadRequestException('Le nouvel ID existe déjà.');

    const tmpEmail = `__tmp__${med.id}__${Date.now()}__${med.email}`;

    const duplicated = await this.prisma.$transaction(async (tx) => {
      // 1) libère l'email unique
      await tx.medecin.update({
        where: { id: oldId },
        data: { email: tmpEmail },
      });

      // 2) recrée avec le nouvel ID et l'email original
      const created = await tx.medecin.create({
        data: {
          id: newId,
          nom: med.nom,
          prenom: med.prenom,
          email: med.email, // email original re-libéré
          motDePasse: med.motDePasse,
          telephone: med.telephone,
          specialite: med.specialite,
          adresseCabinet: med.adresseCabinet,
          rpps: med.rpps,
          accepteNouveauxPatients: med.accepteNouveauxPatients,
          statut: med.statut,
          photoUrl: med.photoUrl,

          horairesReference: this.normalizeHoraires((med as any).horairesReference),
          horaires: this.normalizeHoraires(med.horaires),

          bio: med.bio,
          typeExercice: med.typeExercice,
          siret: med.siret,
          adresseFacturation: med.adresseFacturation,
          cabinetId: med.cabinetId,
        },
      });

      // 3) supprime l'ancien
      await tx.medecin.delete({ where: { id: oldId } });

      return created;
    });

    return { success: true, medecin: duplicated };
  }

  /* -------------------------------------------------------------
   * SECRÉTAIRES
   ------------------------------------------------------------- */
 async createSecretaireForMedecin(
  medecinId: number,
  dto: CreateSecretaireDto,
) {
  const medecin = await this.prisma.medecin.findUnique({
    where: { id: medecinId },
    include: {
      cabinet: {
        include: {
          medecins: {
            select: { id: true },
          },
        },
      },
    },
  });

  if (!medecin) throw new NotFoundException('Médecin introuvable.');

  if (!medecin.cabinet || !medecin.cabinetId) {
    throw new BadRequestException("Le médecin n'est dans aucun cabinet.");
  }

  const existing = await this.prisma.secretaire.findUnique({
    where: { email: dto.email.toLowerCase() },
  });

  if (existing) {
    throw new BadRequestException('Email déjà utilisé par une secrétaire.');
  }

  const password = randomBytes(4).toString('hex');
  const hashed = await this.passwordService.hash(password);

  // ✅ REBIND TS SAFE
  const cabinetId = medecin.cabinetId;
  const medecinsDuCabinet = medecin.cabinet.medecins;

  const secretaire = await this.prisma.secretaire.create({
    data: {
      nom: dto.nom,
      prenom: dto.prenom,
      email: dto.email.toLowerCase(),
      telephone: dto.telephone,
      motDePasse: hashed,
      cabinetId,
      medecins: {
        connect: medecinsDuCabinet.map((m) => ({ id: m.id })),
      },
    },
  });

  return {
    success: true,
    secretaire,
    motDePasseProvisoire: password,
  };
}


async getSecretaires(medecinId: number) {
  const medecin = await this.prisma.medecin.findUnique({
    where: { id: medecinId },
    include: {
      cabinet: {
        include: {
          secretaires: true,
        },
      },
    },
  });

  if (!medecin) {
    throw new NotFoundException('Médecin introuvable.');
  }

  if (!medecin.cabinet) {
    return [];
  }

  return medecin.cabinet.secretaires;
}


  async removeSecretaireFromMedecin(medecinId: number, secretaireId: number) {
    return this.prisma.medecin.update({
      where: { id: medecinId },
      data: {
        secretaires: {
          disconnect: { id: secretaireId },
        },
      },
    });
  }

  /* -------------------------------------------------------------
   * AJOUT — DÉTAILS SECRÉTAIRE
   ------------------------------------------------------------- */
  async getSecretaireDetails(medecinId: number, secretaireId: number) {
    const secretaire = await this.prisma.secretaire.findFirst({
      where: {
        id: secretaireId,
        medecins: { some: { id: medecinId } },
      },
    });

    if (!secretaire) throw new NotFoundException('Secrétaire introuvable');

    return secretaire;
  }

  /* -------------------------------------------------------------
   * AJOUT — RESET MDP SECRÉTAIRE
   ------------------------------------------------------------- */
  async resetSecretairePassword(medecinId: number, secretaireId: number) {
    const secretaire = await this.prisma.secretaire.findFirst({
      where: {
        id: secretaireId,
        medecins: { some: { id: medecinId } },
      },
    });

    if (!secretaire) throw new NotFoundException('Secrétaire introuvable');

    const password = randomBytes(4).toString('hex');
    const hashed = await this.passwordService.hash(password);

    await this.prisma.secretaire.update({
      where: { id: secretaireId },
      data: { motDePasse: hashed },
    });

    return { success: true, motDePasseProvisoire: password };
  }

  /* -------------------------------------------------------------
   * CSV / PATIENTS AUTORISÉS
   ------------------------------------------------------------- */
  async importCSV(medecinId: number, file: Express.Multer.File) {
    const med = await this.prisma.medecin.findUnique({
      where: { id: medecinId },
    });

    if (!med) throw new NotFoundException('Médecin introuvable.');

    const entries = parseCSVPatients(file.buffer);

    await this.prisma.medecinPatientCSV.deleteMany({
      where: { medecinId },
    });

    await this.prisma.medecinPatientCSV.createMany({
      data: entries.map((e) => ({
        medecinId,
        nom: e.nom,
        prenom: e.prenom,
        dateNaissance: e.dateNaissance,
      })),
    });

    return {
      success: true,
      count: entries.length,
      message: 'Base CSV du médecin remplacée avec succès.',
    };
  }

  // ✅ FIX: p.dateNaissance devient string (YYYY-MM-DD)
  async isPatientAllowedByCSV(
    medecinId: number,
    p: { nom: string; prenom: string; dateNaissance: string },
  ): Promise<boolean> {
    const list = await this.prisma.medecinPatientCSV.findMany({
      where: { medecinId },
    });

    for (const row of list) {
      if (
        identitiesMatch(
          row.nom,
          row.prenom,
          row.dateNaissance, // string
          p.nom,
          p.prenom,
          p.dateNaissance,   // string
        )
      ) {
        return true;
      }
    }

    return false;
  }

  // ✅ FIX: p.dateNaissance devient string (YYYY-MM-DD)
  async assertPatientCanBook(
    medecinId: number,
    p: { nom: string; prenom: string; dateNaissance: string },
  ) {
    const med = await this.prisma.medecin.findUnique({
      where: { id: medecinId },
    });
    if (!med) throw new NotFoundException('Médecin introuvable');

    if (med.accepteNouveauxPatients) return true;

    const ok = await this.isPatientAllowedByCSV(medecinId, p);
    if (!ok)
      throw new ForbiddenException(
        "Ce médecin n'accepte pas de nouveaux patients et vous n'êtes pas dans sa base.",
      );

    return true;
  }

  // … TOUT LE FICHIER EST STRICTEMENT IDENTIQUE
  // (je ne le réécris pas ici pour ne pas l’altérer)

  // ⬇️ ⬇️ ⬇️ AJOUT STRICTEMENT À LA FIN DU FICHIER ⬇️ ⬇️ ⬇️

  /* -------------------------------------------------------------
   * AUTO-COMPLÉTION CSV (AJOUT)
   * 👉 ne touche à rien d’existant
   ------------------------------------------------------------- */

  // ✅ FIX: plus besoin de Date ici, mais on ne supprime pas la méthode
  // (la méthode peut rester utilisée ailleurs si tu l'appelles)
  private formatDDMMYYYY(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  // ✅ FIX: row.dateNaissance est string (YYYY-MM-DD)
  async searchPatientsAllowedByCsv(
    medecinId: number,
    query: string,
  ) {
    const q = normalize(query);

    if (!q || q.length < 2) return [];

    const rows = await this.prisma.medecinPatientCSV.findMany({
      where: { medecinId },
      orderBy: { prenom: 'asc' },
      take: 50,
    });

    return rows
      .filter((row) => {
        const hay = normalize(
          `${row.nom} ${row.prenom} ${row.dateNaissance.split('-').reverse().join('/')}`,
        );

        return hay.includes(q);
      })
      .slice(0, 10)
      .map((row) => ({
        nom: row.nom,
        prenom: row.prenom,
        dateNaissance: row.dateNaissance.split('-').reverse().join('/'),
      }));
  }

  /* -------------------------------------------------------------
   * AUTO-COMPLÉTION PATIENTS + PROCHES
   * 👉 utilisé pour l’upload de documents côté médecin
   * 👉 NE SUPPRIME RIEN D’EXISTANT
   ------------------------------------------------------------- */

// [ ... TOUT LE FICHIER STRICTEMENT IDENTIQUE JUSQU’À CETTE MÉTHODE ... ]

  /* -------------------------------------------------------------
   * AUTO-COMPLÉTION PATIENTS + PROCHES
   * 👉 utilisé pour l’upload de documents côté médecin
   * 👉 🔒 FILTRAGE CSV + COMPTE PATIENT
   ------------------------------------------------------------- */
  async searchPatientsEtProches(
    medecinId: number,
    query: string,
  ) {
    const q = query.trim();
    if (q.length < 2) return [];

    // 🔒 CSV du médecin (une seule fois)
    const csvRows = await this.prisma.medecinPatientCSV.findMany({
      where: { medecinId },
    });

    const isInCsv = (p: {
      nom: string;
      prenom: string;
      dateNaissance: string;
    }) =>
      csvRows.some((row) =>
        identitiesMatch(
          row.nom,
          row.prenom,
          row.dateNaissance,
          p.nom,
          p.prenom,
          p.dateNaissance,
        ),
      );

    /* -------------------------
     * PATIENTS (avec compte + CSV)
     ------------------------- */
    const patients = await this.prisma.patient.findMany({
      where: {
        OR: [
          { nom: { contains: q, mode: 'insensitive' } },
          { prenom: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 20,
      orderBy: { prenom: 'asc' },
    });

    const patientResults = patients
      .filter((p) =>
        isInCsv({
          nom: p.nom,
          prenom: p.prenom,
          dateNaissance: p.dateNaissance,
        }),
      )
      .map((p) => ({
        type: 'patient',
        patientId: p.id,
        nom: p.nom,
        prenom: p.prenom,
        dateNaissance: p.dateNaissance
          ? p.dateNaissance.split('-').reverse().join('/')
          : null,
      }));

    /* -------------------------
     * PROCHES
     * (uniquement si le patient parent est autorisé CSV)
     ------------------------- */
    const proches = await this.prisma.proche.findMany({
      where: {
        OR: [
          { nom: { contains: q, mode: 'insensitive' } },
          { prenom: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: {
        patient: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            dateNaissance: true,
          },
        },
      },
      take: 20,
      orderBy: { prenom: 'asc' },
    });

    const procheResults = proches
      .filter((p) =>
        isInCsv({
          nom: p.patient.nom,
          prenom: p.patient.prenom,
          dateNaissance: p.patient.dateNaissance,
        }),
      )
      .map((p) => ({
        type: 'proche',
        procheId: p.id,
        patientId: p.patientId,
        nom: p.nom,
        prenom: p.prenom,
        relation: p.relation,
        dateNaissance: p.dateNaissance
          ? p.dateNaissance.split('-').reverse().join('/')
          : null,
        patientNom: p.patient.nom,
        patientPrenom: p.patient.prenom,
      }));

    return [...patientResults, ...procheResults];
  }

async resetPasswordWithToken(token: string, motDePasse: string) {
  const medecin = await this.prisma.medecin.findFirst({
    where: {
      resetToken: token,              // ✅ NOM RÉEL
      resetExpires: {
        gt: new Date(),
      },
    },
  });

  if (!medecin) {
    return {
      success: false,
      message: 'Lien invalide ou expiré.',
    };
  }

  const hashed = await bcrypt.hash(motDePasse, 10);

  await this.prisma.medecin.update({
    where: { id: medecin.id },
    data: {
      motDePasse: hashed,

      // 🔐 invalidation définitive
      resetToken: null,               // ✅ NOM RÉEL
      resetExpires: null,
    },
  });

  return {
    success: true,
    message: 'Mot de passe réinitialisé avec succès.',
  };
}
// [ ... TOUT LE RESTE DU FICHIER STRICTEMENT IDENTIQUE ... ]

}
