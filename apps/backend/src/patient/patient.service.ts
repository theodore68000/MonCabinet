import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { MailService } from '../mail/mail.service';
import { PasswordService } from '../common/security/password.service';
import { normalize } from "src/common/identity.utils";


// ───────────────────────────────────────────────
// 📌 Stockage temporaire des inscriptions en attente
// ───────────────────────────────────────────────
export const pendingPatients = new Map<
  string,
  {
    form: CreatePatientDto;
    code: string;
    expire: Date;
  }
>();

@Injectable()
export class PatientService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private passwordService: PasswordService,
  ) {}

  /* ─────────────────────────────────────────────── */
  /* 🔧 UTIL DATE — dd/mm/yyyy → YYYY-MM-DD (STRING) */
  /* ─────────────────────────────────────────────── */
  private parseDateNaissance(date: string): string {
    const [dd, mm, yyyy] = date.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }

  /* ------------------------------------------------------------- */
  /* 🔥 FAVORIS */
  /* ------------------------------------------------------------- */
  async getFavoris(patientId: number) {
    return this.prisma.patientFavori.findMany({
      where: { patientId },
      include: {
        medecin: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            photoUrl: true,
            specialite: true,
          },
        },
      },
    });
  }

  async addFavori(patientId: number, medecinId: number) {
    const count = await this.prisma.patientFavori.count({
      where: { patientId },
    });

    if (count >= 20)
      return { success: false, message: 'Maximum 20 médecins favoris.' };

    await this.prisma.patientFavori.upsert({
      where: { patientId_medecinId: { patientId, medecinId } },
      create: { patientId, medecinId },
      update: {},
    });

    return { success: true };
  }

  async removeFavori(patientId: number, medecinId: number) {
    await this.prisma.patientFavori.deleteMany({
      where: { patientId, medecinId },
    });

    return { success: true };
  }

  /* ------------------------------------------------------------- */
  async findAllByMedecin(medecinId: number) {
    return this.prisma.patient.findMany({
      where: {
        OR: [
          { rdvs: { some: { medecinId } } },
          { proches: { some: { rdvs: { some: { medecinId } } } } },
        ],
      },
    });
  }

  /* ------------------------------------------------------------- */
  async create(data: CreatePatientDto) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expire = new Date(Date.now() + 10 * 60 * 1000);

    const exists = await this.prisma.patient.findUnique({
      where: { email: data.email },
    });
    if (exists) {
      return { success: false, message: 'Un compte existe déjà avec cet email.' };
    }

    pendingPatients.set(data.email, { form: data, code, expire });

    await this.mailService.send(
      data.email,
      'Vérification de votre compte',
      `<h1>${code}</h1>`,
    );

    return { success: true, message: 'Code envoyé. Vérifiez votre email.' };
  }

  /* ------------------------------------------------------------- */
  async verifyEmail(email: string, code: string) {
    const pending = pendingPatients.get(email);

    if (!pending)
      return { success: false, message: "Aucune inscription en attente." };
    if (pending.code !== code)
      return { success: false, message: 'Code incorrect.' };
    if (pending.expire < new Date())
      return { success: false, message: 'Code expiré.' };

    const hashed = await this.passwordService.hash(
      pending.form.motDePasse ?? '1234',
    );

    const patient = await this.prisma.patient.create({
      data: {
        nom: pending.form.nom,
        prenom: pending.form.prenom,
        email: pending.form.email,
        motDePasse: hashed,
        telephone: pending.form.telephone,
        adresse: pending.form.adresse,
        dateNaissance: this.parseDateNaissance(
          pending.form.dateNaissance,
        ),
        emailVerified: true,
      },
    });

    pendingPatients.delete(email);
    return { success: true, patient };
  }

  /* ------------------------------------------------------------- */
  async login(email: string, motDePasse: string) {
    const patient = await this.prisma.patient.findUnique({ where: { email } });

    if (!patient || !patient.motDePasse)
      return { message: 'Email ou mot de passe incorrect' };

    const valid = await this.passwordService.compare(
      motDePasse,
      patient.motDePasse,
    );

    if (!valid) return { message: 'Email ou mot de passe incorrect' };

    return patient;
  }

  /* ------------------------------------------------------------- */
  async forgotPassword(email: string) {
    const patient = await this.prisma.patient.findUnique({ where: { email } });
    if (!patient)
      return { success: false, message: "Aucun compte n'existe avec cet email." };

    const resetToken =
      Math.random().toString(36).substring(2) + Date.now().toString(36);
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.patient.update({
      where: { id: patient.id },
      data: { resetToken, resetExpires },
    });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const resetLink = `${appUrl}/patient/reset-password?token=${resetToken}`;

    await this.mailService.sendPasswordResetEmail(email, resetLink);

    return { success: true, message: 'Email envoyé.' };
  }

  /* ------------------------------------------------------------- */
  async resetPassword(token: string, motDePasse: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { resetToken: token, resetExpires: { gt: new Date() } },
    });

    if (!patient)
      return { success: false, message: 'Lien invalide ou expiré.' };

    const hashed = await this.passwordService.hash(motDePasse);

    await this.prisma.patient.update({
      where: { id: patient.id },
      data: { motDePasse: hashed, resetToken: null, resetExpires: null },
    });

    return { success: true, message: 'Mot de passe réinitialisé.' };
  }

  /* ------------------------------------------------------------- */
  async getOneForMedecin(patientId: number, medecinId: number) {
    const hasRdv = await this.prisma.rendezVous.findFirst({
      where: {
        medecinId,
        OR: [{ patientId }, { proche: { patientId } }],
      },
    });

    if (!hasRdv) throw new ForbiddenException('Accès refusé au patient.');

    return this.findOne(patientId);
  }

  /* ------------------------------------------------------------- */
  findAll() {
    return this.prisma.patient.findMany();
  }

  findOne(id: number) {
    return this.prisma.patient.findUnique({ where: { id } });
  }

  update(id: number, data: UpdatePatientDto) {
    if (data.dateNaissance) {
      data.dateNaissance = this.parseDateNaissance(data.dateNaissance);
    }

    return this.prisma.patient.update({ where: { id }, data });
  }

  /* ------------------------------------------------------------- */
  /* 🔥 REMOVE — SOLUTION B (FULL) */
  /* ------------------------------------------------------------- */
  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const proches = await tx.proche.findMany({
        where: { patientId: id },
        select: { id: true },
      });
      const procheIds = proches.map((p) => p.id);

      await tx.document.deleteMany({
        where: {
          OR: [{ patientId: id }, { procheId: { in: procheIds } }],
        },
      });

      await tx.formulairePreconsultation.deleteMany({
        where: { patientId: id },
      });

      await tx.paiement.deleteMany({
        where: { patientId: id },
      });

      await tx.avisMedecin.deleteMany({
        where: { patientId: id },
      });

      await tx.patientFavori.deleteMany({
        where: { patientId: id },
      });

      await tx.rendezVous.updateMany({
        where: { patientId: id },
        data: {
          patientId: null,
          motif: null,
          typeSlot: 'LIBRE',
        },
      });

      if (procheIds.length) {
        await tx.rendezVous.updateMany({
          where: { procheId: { in: procheIds } },
          data: {
            procheId: null,
            motif: null,
            typeSlot: 'LIBRE',
          },
        });
      }

      await tx.proche.deleteMany({
        where: { patientId: id },
      });

      await tx.patient.delete({
        where: { id },
      });

      return { success: true };
    });
  }

  /* ------------------------------------------------------------- */
  async updatePassword(id: number, oldPass: string, newPass: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id } });

    if (!patient || !patient.motDePasse)
      throw new Error('Patient introuvable');

    const valid = await this.passwordService.compare(
      oldPass,
      patient.motDePasse,
    );
    if (!valid) throw new Error('Ancien mot de passe incorrect');

    return this.prisma.patient.update({
      where: { id },
      data: { motDePasse: await this.passwordService.hash(newPass) },
    });
  }

  /* ------------------------------------------------------------- */
  async createDirect(data: CreatePatientDto) {
    const hashed = await this.passwordService.hash(
      data.motDePasse ?? '1234',
    );

    return this.prisma.patient.create({
      data: {
        nom: data.nom,
        prenom: data.prenom,
        email: data.email,
        motDePasse: hashed,
        telephone: data.telephone,
        adresse: data.adresse,
        dateNaissance: this.parseDateNaissance(data.dateNaissance),
        emailVerified: true,
      },
    });
  }

  async canAccessMedecin(patientId: number, medecinId: number) {
  const medecin = await this.prisma.medecin.findUnique({
    where: { id: medecinId },
    select: {
      accepteNouveauxPatients: true,
    },
  });

  if (!medecin) return { allowed: false };

  if (medecin.accepteNouveauxPatients) {
    return { allowed: true };
  }

  const patient = await this.prisma.patient.findUnique({
    where: { id: patientId },
    select: { nom: true, prenom: true, dateNaissance: true },
  });

  if (!patient) return { allowed: false };

  const rows = await this.prisma.medecinPatientCSV.findMany({
    where: { medecinId },
  });

  const found = rows.some(
    (row) =>
      normalize(row.nom) === normalize(patient.nom) &&
      normalize(row.prenom) === normalize(patient.prenom) &&
      row.dateNaissance === patient.dateNaissance
  );

  return { allowed: found };
}

  /* ------------------------------------------------------------- */
  async searchPatients(query: string, secretaireId: number) {
    if (!query || query.length < 2) return [];

    const secretaire = await this.prisma.secretaire.findUnique({
      where: { id: secretaireId },
      select: { cabinetId: true },
    });

    if (!secretaire || !secretaire.cabinetId) return [];

    const medecins = await this.prisma.medecin.findMany({
      where: { cabinetId: secretaire.cabinetId },
      select: { id: true },
    });

    const medecinIds = medecins.map((m) => m.id);

    return this.prisma.patient.findMany({
      where: {
        OR: [
          { rdvs: { some: { medecinId: { in: medecinIds } } } },
          {
            proches: {
              some: {
                rdvs: { some: { medecinId: { in: medecinIds } } },
              },
            },
          },
        ],
        AND: {
          OR: [
            { nom: { contains: query, mode: 'insensitive' } },
            { prenom: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        notePatient: true,
      },
    });
  }
}
