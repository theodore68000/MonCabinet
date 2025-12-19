import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSecretaireDto } from './dto/update-secretaire.dto';
import { CreateSecretaireDto } from './dto/create-secretaire.dto';
import { PasswordService } from '../common/security/password.service';

@Injectable()
export class SecretaireService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  // ─────────────────────────────────────────
  // LOGIN (SÉCURISÉ)
  // ─────────────────────────────────────────
  async login(email: string, motDePasse: string) {
    const secretaire = await this.prisma.secretaire.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        cabinet: {
          select: {
            id: true,
            nom: true,
          },
        },
      },
    });

    if (!secretaire) {
      return { success: false, message: 'Aucun compte associé à cet email.' };
    }

    const valid = await this.passwordService.compare(
      motDePasse,
      secretaire.motDePasse,
    );

    if (!valid) {
      return { success: false, message: 'Mot de passe incorrect.' };
    }

    const {
      motDePasse: _,
      resetToken,
      resetExpires,
      ...safeSecretaire
    } = secretaire;

    return {
      success: true,
      secretaire: safeSecretaire,
    };
  }

  // ─────────────────────────────────────────
  // CREATE SECRETAIRE (PAR MEDECIN)
  // ─────────────────────────────────────────
  async create(
    medecinCreateurId: number,
    dto: CreateSecretaireDto,
  ) {
    const medecin = await this.prisma.medecin.findUnique({
      where: { id: medecinCreateurId },
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

    if (!medecin) {
      throw new BadRequestException('Médecin introuvable.');
    }

    if (!medecin.cabinet || medecin.cabinetId === null) {
      throw new BadRequestException(
        'Ce médecin n’est rattaché à aucun cabinet.',
      );
    }

    // ✅ FIX TS — rebind explicite (clé)
    const cabinet = medecin.cabinet;
    const cabinetId: number = medecin.cabinetId;

    const hashedPassword = await this.passwordService.hash(
      Math.random().toString(36).slice(-10),
    );

    const secretaire = await this.prisma.$transaction(async (tx) => {
      const created = await tx.secretaire.create({
        data: {
          nom: dto.nom,
          prenom: dto.prenom,
          email: dto.email.toLowerCase(),
          telephone: dto.telephone,
          motDePasse: hashedPassword,
          cabinetId,
        },
      });

      await tx.secretaire.update({
        where: { id: created.id },
        data: {
          medecins: {
            connect: cabinet.medecins.map((m) => ({
              id: m.id,
            })),
          },
        },
      });

      return created;
    });

    return {
      success: true,
      secretaireId: secretaire.id,
    };
  }

  // ─────────────────────────────────────────
  // PROFIL SECRETAIRE (SAFE POUR LE FRONT)
  // ─────────────────────────────────────────
  async findOne(id: number) {
    return this.prisma.secretaire.findUnique({
      where: { id },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        cabinetId: true,
        cabinet: {
          select: {
            id: true,
            nom: true,
          },
        },
      },
    });
  }

  // ─────────────────────────────────────────
  // UPDATE PROFIL
  // ─────────────────────────────────────────
  async update(id: number, dto: UpdateSecretaireDto) {
    const data: any = { ...dto };

    if (dto.motDePasse) {
      data.motDePasse = await this.passwordService.hash(dto.motDePasse);
    }

    return this.prisma.secretaire.update({
      where: { id },
      data,
    });
  }

  // ─────────────────────────────────────────
  // MEDECINS LIÉS À LA SECRETAIRE
  // ─────────────────────────────────────────
  async getMedecins(secretaireId: number) {
    const secretaire = await this.prisma.secretaire.findUnique({
      where: { id: secretaireId },
      include: {
        medecins: {
          select: {
            id: true,
            nom: true,
            prenom: true,
          },
        },
      },
    });

    if (!secretaire) {
      return { success: false, message: 'Secrétaire introuvable.' };
    }

    return {
      success: true,
      medecins: secretaire.medecins,
    };
  }
}
