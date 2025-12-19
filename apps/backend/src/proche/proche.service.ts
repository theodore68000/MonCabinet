import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProcheDto } from './dto/create-proche.dto';
import { UpdateProcheDto } from './dto/update-proche.dto';

@Injectable()
export class ProcheService {
  constructor(private prisma: PrismaService) {}

  /* ─────────────────────────────────────────────── */
  /* UTILS DATE — STRING UNIQUEMENT */
  /* ─────────────────────────────────────────────── */
  private parseDateNaissance(
    date?: string,
    year?: number,
  ): string {
    // priorité au format métier dd/mm/yyyy
    if (date) {
      const [dd, mm, yyyy] = date.split('/');

      if (
        !dd || !mm || !yyyy ||
        dd.length !== 2 ||
        mm.length !== 2 ||
        yyyy.length !== 4 ||
        isNaN(Number(dd)) ||
        isNaN(Number(mm)) ||
        isNaN(Number(yyyy))
      ) {
        throw new BadRequestException('dateNaissance invalide.');
      }

      return `${yyyy}-${mm}-${dd}`;
    }

    // compat legacy : anneeNaissance => 01/01/YYYY
    if (year) {
      if (year < 1900 || year > 2100) {
        throw new BadRequestException('anneeNaissance invalide.');
      }
      return `${year}-01-01`;
    }

    throw new BadRequestException('dateNaissance ou anneeNaissance requis.');
  }

  private normalizeNom(v: unknown): string | undefined {
    if (v === null || v === undefined) return undefined;
    return String(v).trim();
  }

  /* ─────────────────────────────────────────────── */
  /* CREATE */
  /* ─────────────────────────────────────────────── */
  async create(data: CreateProcheDto) {
    const patientId = data.patientId;

    if (!patientId) {
      throw new BadRequestException('patientId est requis pour créer un proche.');
    }

    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true },
    });

    if (!patient) {
      throw new NotFoundException('Patient introuvable.');
    }

    const count = await this.prisma.proche.count({
      where: { patientId },
    });

    if (count >= 10) {
      throw new ForbiddenException('Nombre maximal de proches atteint (10).');
    }

    const dateNaissance = this.parseDateNaissance(
      data.dateNaissance,
      data.anneeNaissance,
    );

    const nom = this.normalizeNom(data.nom) ?? '';
    const prenom = this.normalizeNom(data.prenom);
    const relation = this.normalizeNom(data.relation);

    if (!prenom) throw new BadRequestException('prenom est requis.');
    if (!relation) throw new BadRequestException('relation est requise.');

    return this.prisma.proche.create({
      data: {
        patient: { connect: { id: patientId } },
        prenom,
        nom,
        relation,
        notesSante: data.notesSante ?? null,
        dateNaissance,
      },
    });
  }

  /* ─────────────────────────────────────────────── */
  /* LISTE DES PROCHES D'UN PATIENT */
  /* ─────────────────────────────────────────────── */
  async findByPatient(patientId: number) {
    return this.prisma.proche.findMany({
      where: { patientId },
      orderBy: { prenom: 'asc' },
    });
  }

  /* ─────────────────────────────────────────────── */
  /* UN PROCHE */
  /* ─────────────────────────────────────────────── */
  async findOne(id: number) {
    const proche = await this.prisma.proche.findUnique({
      where: { id },
    });

    if (!proche) {
      throw new NotFoundException('Proche introuvable');
    }

    return proche;
  }

  /* ─────────────────────────────────────────────── */
  /* UPDATE */
  /* ─────────────────────────────────────────────── */
  async update(id: number, data: UpdateProcheDto) {
    const existing = await this.prisma.proche.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Proche introuvable');
    }

    const updateData: any = {};

    if (data.prenom !== undefined) {
      const prenom = this.normalizeNom(data.prenom);
      if (!prenom) throw new BadRequestException('prenom invalide.');
      updateData.prenom = prenom;
    }

    if (data.nom !== undefined) {
      updateData.nom = this.normalizeNom(data.nom) ?? '';
    }

    if (data.relation !== undefined) {
      const relation = this.normalizeNom(data.relation);
      if (!relation) throw new BadRequestException('relation invalide.');
      updateData.relation = relation;
    }

    if (data.notesSante !== undefined) {
      updateData.notesSante = data.notesSante ?? null;
    }

    if (data.dateNaissance !== undefined || data.anneeNaissance !== undefined) {
      updateData.dateNaissance = this.parseDateNaissance(
        data.dateNaissance,
        data.anneeNaissance,
      );
    }

    return this.prisma.proche.update({
      where: { id },
      data: updateData,
    });
  }

  /* ─────────────────────────────────────────────── */
  /* DELETE */
  /* ─────────────────────────────────────────────── */
  async remove(id: number) {
    const existing = await this.prisma.proche.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Proche introuvable');
    }

    return this.prisma.proche.delete({
      where: { id },
    });
  }
}
