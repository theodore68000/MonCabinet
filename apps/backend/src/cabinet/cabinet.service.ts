import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCabinetDto } from './dto/create-cabinet.dto';
import { UpdateCabinetDto } from './dto/update-cabinet.dto';

@Injectable()
export class CabinetService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateCabinetDto) {
    return this.prisma.cabinet.create({
      data,
    });
  }

  findAll() {
    return this.prisma.cabinet.findMany({
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
    });
  }

  findOne(id: number) {
    return this.prisma.cabinet.findUnique({
      where: { id },
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
    });
  }

  async update(id: number, data: UpdateCabinetDto) {
    const exists = await this.prisma.cabinet.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException('Cabinet introuvable');
    }

    return this.prisma.cabinet.update({
      where: { id },
      data,
    });
  }

  /**
   * Supprime un cabinet ET tous ses médecins
   */
  async remove(id: number) {
    // Supprimer les médecins du cabinet
    await this.prisma.medecin.deleteMany({
      where: { cabinetId: id },
    });

    // Supprimer le cabinet
    return this.prisma.cabinet.delete({
      where: { id },
    });
  }
}
