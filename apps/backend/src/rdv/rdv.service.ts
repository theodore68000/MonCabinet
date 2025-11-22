import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRdvDto } from './dto/create-rdv.dto';
import { UpdateRdvDto } from './dto/update-rdv.dto';

@Injectable()
export class RdvService {
  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────
  // CREATE RDV — Empêche plusieurs RDV tant que le précédent n'est pas passé
  // ─────────────────────────────────────────

  async create(dto: CreateRdvDto) {
    const dateObj = new Date(dto.date);

    // Reconstruire la date complète du nouveau RDV (date + heure)
    const [h, m] = dto.heure.split(':').map(Number);
    const newRdvDateTime = new Date(dto.date);
    newRdvDateTime.setHours(h, m, 0, 0);

    const now = new Date();

    // Récupérer tous les RDV du patient avec ce médecin
    const existingRdvs = await this.prisma.rendezVous.findMany({
      where: {
        patientId: dto.patientId,
        medecinId: dto.medecinId,
      },
    });

    // Vérification stricte : un seul RDV futur ou en cours possible
    for (const rdv of existingRdvs) {
      const [rh, rm] = rdv.heure.split(':').map(Number);
      const fullDate = new Date(rdv.date);
      fullDate.setHours(rh, rm, 0, 0);

      // Si le RDV existant n'est pas encore passé → interdiction
      if (fullDate >= now) {
        throw new Error(
          'Vous avez déjà un rendez-vous futur ou en attente avec ce médecin. Vous devez attendre qu’il soit passé avant d’en réserver un autre.'
        );
      }
    }

    // Aucune collision → créer le RDV
    return this.prisma.rendezVous.create({
      data: {
        date: dateObj,
        heure: dto.heure,
        motif: dto.motif ?? '',
        statut: 'confirmé',
        patientId: dto.patientId,
        medecinId: dto.medecinId,
      },
      include: { patient: true, medecin: true },
    });
  }

  // ─────────────────────────────────────────
  // READ / UPDATE / DELETE
  // ─────────────────────────────────────────

  async findAll(medecinId?: number, patientId?: number) {
    return this.prisma.rendezVous.findMany({
      where: {
        ...(medecinId ? { medecinId } : {}),
        ...(patientId ? { patientId } : {}),
      },
      orderBy: [{ date: 'asc' }, { heure: 'asc' }],
      include: { patient: true, medecin: true },
    });
  }

  async findOne(id: number) {
    return this.prisma.rendezVous.findUnique({
      where: { id },
      include: { patient: true, medecin: true },
    });
  }

  async update(id: number, dto: UpdateRdvDto) {
    return this.prisma.rendezVous.update({
      where: { id },
      data: dto,
      include: { patient: true, medecin: true },
    });
  }

  async remove(id: number) {
    return this.prisma.rendezVous.delete({
      where: { id },
    });
  }

  // ─────────────────────────────────────────
  // DISPONIBILITÉS BASÉES SUR HORAIRES JSON
  // ─────────────────────────────────────────

  async getDisponibilites(medecinId: number, dateStr: string) {
    const date = new Date(dateStr);
    const dow = date.getDay(); // 0 dim, 1 lun, ..., 6 sam

    // Week-end → aucune dispo
    if (dow === 0 || dow === 6) return [];

    // Récupérer les horaires du médecin
    const medecin = await this.prisma.medecin.findUnique({
      where: { id: medecinId },
    });

    if (!medecin || !medecin.horaires) return [];

    const dayNames = [
      'dimanche',
      'lundi',
      'mardi',
      'mercredi',
      'jeudi',
      'vendredi',
      'samedi',
    ];

    const dayKey = dayNames[dow];

    const horairesJour: string[] = medecin.horaires[dayKey] || [];

    // Génération des créneaux 15 min
    const slots: string[] = [];

    const pushSlots = (start: string, end: string) => {
      let [sh, sm] = start.split(':').map(Number);
      let [eh, em] = end.split(':').map(Number);

      let startMinutes = sh * 60 + sm;
      const endMinutes = eh * 60 + em;

      while (startMinutes < endMinutes) {
        const hh = String(Math.floor(startMinutes / 60)).padStart(2, '0');
        const mm = String(startMinutes % 60).padStart(2, '0');
        slots.push(`${hh}:${mm}`);
        startMinutes += 15;
      }
    };

    // Ajouter toutes les plages horaires définies dans le JSON
    horairesJour.forEach((plage) => {
      const [debut, fin] = plage.split('-');
      if (debut && fin) pushSlots(debut, fin);
    });

    // Récupérer les RDV déjà pris ce jour-là
    const dayStart = new Date(dateStr);
    const dayEnd = new Date(dateStr);
    dayEnd.setHours(23, 59, 59, 999);

    const rdvs = await this.prisma.rendezVous.findMany({
      where: {
        medecinId,
        date: { gte: dayStart, lte: dayEnd },
      },
    });

    const taken = new Set(rdvs.map((r) => r.heure));

    // Renvoie uniquement les horaires libres au format "HH:MM"
    return slots.filter((h) => !taken.has(h));
  }
}
