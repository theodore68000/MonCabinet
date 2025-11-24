import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRdvDto } from "./dto/create-rdv.dto";
import { UpdateRdvDto } from "./dto/update-rdv.dto";

@Injectable()
export class RdvService {
  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────
  // 📌 1. Création RDV (utilisée par le médecin via /rdv)
  // ─────────────────────────────────────────
  async create(dto: CreateRdvDto) {
    const dateObj = new Date(dto.date);
    if (Number.isNaN(dateObj.getTime())) {
      throw new BadRequestException("Date invalide.");
    }
    if (!dto.heure) {
      throw new BadRequestException("Heure obligatoire.");
    }

    // Vérifier si le créneau est déjà occupé (quel que soit le statut)
    const existing = await this.prisma.rendezVous.findFirst({
      where: {
        medecinId: dto.medecinId,
        date: dateObj,
        heure: dto.heure,
      },
    });

    if (existing) {
      throw new BadRequestException("Ce créneau est déjà pris.");
    }

    const hasPatient = dto.patientId !== null && dto.patientId !== undefined;

    return this.prisma.rendezVous.create({
      data: {
        date: dateObj,
        heure: dto.heure,
        motif: dto.motif ?? "",
        statut: hasPatient ? "confirmé" : "disponible",
        patientId: hasPatient ? dto.patientId! : null,
        medecinId: dto.medecinId,
      },
      include: { patient: true },
    });
  }

  // ─────────────────────────────────────────
  // 📌 1bis. Création RDV par un patient (ex: POST /rdv/patient)
  // ─────────────────────────────────────────
  async createForPatient(dto: CreateRdvDto) {
    const dateObj = new Date(dto.date);
    if (Number.isNaN(dateObj.getTime())) {
      throw new BadRequestException("Date invalide.");
    }

    if (!dto.patientId) {
      throw new BadRequestException("Patient obligatoire.");
    }

    // Vérifier si le patient a déjà un rendez-vous futur
    const existingFuture = await this.prisma.rendezVous.findFirst({
      where: {
        patientId: dto.patientId,
        date: { gte: new Date() },
      },
    });

    if (existingFuture) {
      throw new BadRequestException("Vous avez déjà un rendez-vous prévu.");
    }

    // Vérifier si le créneau est libre
    const existingSlot = await this.prisma.rendezVous.findFirst({
      where: {
        medecinId: dto.medecinId,
        date: dateObj,
        heure: dto.heure,
      },
    });

    if (existingSlot) {
      throw new BadRequestException("Ce créneau est déjà pris.");
    }

    return this.prisma.rendezVous.create({
      data: {
        date: dateObj,
        heure: dto.heure,
        statut: "en_attente",
        patientId: dto.patientId,
        medecinId: dto.medecinId,
        motif: dto.motif ?? "",
      },
    });
  }

  // ─────────────────────────────────────────
  // 📌 2. Récupération RDV avec filtres
  // ─────────────────────────────────────────
  async findAll(medecinId?: number, patientId?: number) {
    return this.prisma.rendezVous.findMany({
      where: {
        ...(medecinId ? { medecinId } : {}),
        ...(patientId ? { patientId } : {}),
      },
      orderBy: [{ date: "asc" }, { heure: "asc" }],
      include: { patient: true, medecin: true },
    });
  }

  // ─────────────────────────────────────────
  // 📌 3. PLANNING JOUR / SEMAINE POUR LE DASHBOARD
  // ─────────────────────────────────────────
  async getByMedecinAndPeriod(
    medecinId: number,
    start: string,
    end: string,
  ) {
    const startDate = new Date(start);
    const endDate = new Date(end);

    const rdvs = await this.prisma.rendezVous.findMany({
      where: {
        medecinId,
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
      orderBy: [{ date: "asc" }, { heure: "asc" }],
      include: {
        patient: {
          select: { id: true, nom: true, prenom: true },
        },
      },
    });

    return { success: true, rdvs };
  }

  // ─────────────────────────────────────────
  // 📌 4. DISPONIBILITÉS (patients)
  // ─────────────────────────────────────────
  async getDisponibilites(medecinId: number, dateStr: string) {
    const date = new Date(dateStr);
    const dow = date.getDay();

    // on pourrait plus tard autoriser samedi/dimanche si besoin
    if (dow === 0 || dow === 6) return [];

    const medecin = await this.prisma.medecin.findUnique({
      where: { id: medecinId },
    });

    if (!medecin || !medecin.horaires) return [];

    const dayNames = [
      "dimanche",
      "lundi",
      "mardi",
      "mercredi",
      "jeudi",
      "vendredi",
      "samedi",
    ];

    const dayKey = dayNames[dow];
    const horairesJour: string[] = medecin.horaires[dayKey] || [];

    const slots: string[] = [];
    const pushSlots = (start: string, end: string) => {
      let [sh, sm] = start.split(":").map(Number);
      let [eh, em] = end.split(":").map(Number);

      let startMinutes = sh * 60 + sm;
      const endMinutes = eh * 60 + em;

      while (startMinutes < endMinutes) {
        const hh = String(Math.floor(startMinutes / 60)).padStart(2, "0");
        const mm = String(startMinutes % 60).padStart(2, "0");
        slots.push(`${hh}:${mm}`);
        startMinutes += 15;
      }
    };

    horairesJour.forEach((plage) => {
      const [debut, fin] = plage.split("-");
      if (debut && fin) pushSlots(debut, fin);
    });

    const dayStart = new Date(dateStr);
    const dayEnd = new Date(dateStr);
    dayEnd.setHours(23, 59, 59, 999);

    const rdvs = await this.prisma.rendezVous.findMany({
      where: {
        medecinId,
        date: { gte: dayStart, lte: dayEnd },
      },
    });

    // Tous les rdv existants (peu importe le statut) bloquent le créneau
    const taken = new Set(rdvs.map((r) => r.heure));

    return slots.filter((h) => !taken.has(h));
  }

  // ─────────────────────────────────────────
  // 📌 5. CRÉATION D’UN CRÉNEAU DISPONIBLE (dashboard)
  // ─────────────────────────────────────────
  async createSlot(data: {
    medecinId: number;
    date: string;
    heure: string;
    motif?: string;
  }) {
    const dateObj = new Date(data.date);
    if (Number.isNaN(dateObj.getTime())) {
      throw new BadRequestException("Date invalide.");
    }

    const existing = await this.prisma.rendezVous.findFirst({
      where: {
        medecinId: data.medecinId,
        date: dateObj,
        heure: data.heure,
      },
    });

    if (existing) {
      throw new BadRequestException(
        "Un créneau existe déjà à cet horaire pour ce médecin.",
      );
    }

    const rdv = await this.prisma.rendezVous.create({
      data: {
        medecinId: data.medecinId,
        date: dateObj,
        heure: data.heure,
        motif: data.motif ?? null,
        statut: "disponible",
        patientId: null,
      },
    });

    return { success: true, rdv };
  }

  // ─────────────────────────────────────────
  // 📌 6. READ / UPDATE / DELETE / ANNULATION
  // ─────────────────────────────────────────
  async findOne(id: number) {
    return this.prisma.rendezVous.findUnique({
      where: { id },
      include: { patient: true, medecin: true },
    });
  }

  async update(id: number, dto: UpdateRdvDto) {
    const data: any = { ...dto };

    if (dto.date) {
      const dateObj = new Date(dto.date);
      if (Number.isNaN(dateObj.getTime())) {
        throw new BadRequestException("Date invalide.");
      }
      data.date = dateObj;
    }

    return this.prisma.rendezVous.update({
      where: { id },
      data,
      include: { patient: true, medecin: true },
    });
  }

  // 👉 Ici on n'efface plus le RDV en base :
  //    on le passe en "indisponible" pour bloquer définitivement le créneau
  async remove(id: number) {
    const rdv = await this.prisma.rendezVous.findUnique({
      where: { id },
    });

    if (!rdv) {
      throw new NotFoundException("RDV introuvable.");
    }

    const updated = await this.prisma.rendezVous.update({
      where: { id },
      data: {
        patientId: null,
        statut: "indisponible",
        motif: null,
      },
    });

    return { success: true, rdv: updated };
  }
}
