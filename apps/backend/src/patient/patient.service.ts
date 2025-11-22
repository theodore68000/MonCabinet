import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientService {
  constructor(private prisma: PrismaService) {}

  // CREATE
  create(data: CreatePatientDto) {
    return this.prisma.patient.create({
      data: {
        nom: data.nom,
        prenom: data.prenom,
        email: data.email,
        motDePasse: data.motDePasse ?? '1234',
        telephone: data.telephone,
        adresse: data.adresse,
        anneeNaissance: data.anneeNaissance,
        medecinTraitantId: data.medecinTraitantId,
      },
      include: { medecinTraitant: true },   // ✔ Correction
    });
  }

  // LOGIN
  async login(email: string, motDePasse: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { email },
      include: { medecinTraitant: true }, // ✔ OK
    });

    if (!patient) {
      return { message: 'Email introuvable' };
    }

    if (patient.motDePasse !== motDePasse) {
      return { message: 'Mot de passe incorrect' };
    }

    return {
      id: patient.id,
      nom: patient.nom,
      prenom: patient.prenom,
      email: patient.email,
      telephone: patient.telephone,
      adresse: patient.adresse,
      anneeNaissance: patient.anneeNaissance,
      medecinTraitantId: patient.medecinTraitantId,
      medecinTraitant: patient.medecinTraitant,
    };
  }

  // FIND ALL
  findAll() {
    return this.prisma.patient.findMany({
      include: { medecinTraitant: true },
    });
  }

  // FIND ONE
  findOne(id: number) {
    return this.prisma.patient.findUnique({
      where: { id },
      include: { medecinTraitant: true },
    });
  }

  // UPDATE (🔥 CORRIGÉ)
  update(id: number, data: UpdatePatientDto) {
    return this.prisma.patient.update({
      where: { id },
      data,
      include: { medecinTraitant: true },   // ✔ Correction critique
    });
  }

  // DELETE
  remove(id: number) {
    return this.prisma.patient.delete({
      where: { id },
    });
  }
}
