import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedecinDto } from './dto/create-medecin.dto';
import { UpdateMedecinDto } from './dto/update-medecin.dto';

@Injectable()
export class MedecinService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateMedecinDto) {
    return this.prisma.medecin.create({
      data: {
        nom: data.nom,
        prenom: data.prenom,
        email: data.email,
        motDePasse: data.motDePasse ?? '1234',
        telephone: data.telephone,
        specialite: data.specialite,
        adresseCabinet: data.adresseCabinet,
        rpps: data.rpps,
        accepteNouveauxPatients:
          data.accepteNouveauxPatients ?? true,
        statut: data.statut ?? 'en_attente',
        photoUrl: data.photoUrl,
        horaires: data.horaires,
        bio: data.bio,
        typeExercice: data.typeExercice,
        siret: data.siret,
        adresseFacturation: data.adresseFacturation,
        cabinetId: data.cabinetId ?? null,
      },
    });
  }

  findAll() {
    return this.prisma.medecin.findMany({
      include: {
        cabinet: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.medecin.findUnique({
      where: { id },
      include: { cabinet: true },
    });
  }

  update(id: number, data: UpdateMedecinDto) {
    return this.prisma.medecin.update({
      where: { id },
      data,
    });
  }

  remove(id: number) {
    return this.prisma.medecin.delete({ where: { id } });
  }
}
