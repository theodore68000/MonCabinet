import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { identitiesMatch } from "../common/identity.utils";
import * as fs from "fs";
import * as path from "path";
import { Patient } from "@prisma/client";

@Injectable()
export class DocumentService {
  constructor(private prisma: PrismaService) {}

  /* =========================================================
   * UPLOAD DOCUMENT (PATIENT OU PROCHE)
   ========================================================= */
  async uploadForPatientOrProche(data: {
    patientId?: number | null;
    procheId?: number | null;
    medecinId: number;
    type: string;
    url: string;
    filename?: string;
  }) {
    const { medecinId, type, url, filename } = data;
    let { patientId, procheId } = data;

    /* -------------------------------
     * Validation XOR
     -------------------------------- */
    if (!!patientId === !!procheId) {
      throw new BadRequestException(
        "Le document doit être rattaché soit à un patient soit à un proche."
      );
    }

    /* -------------------------------
     * Médecin
     -------------------------------- */
    const medecin = await this.prisma.medecin.findUnique({
      where: { id: medecinId },
      select: { id: true, accepteNouveauxPatients: true },
    });

    if (!medecin) {
      throw new NotFoundException("Médecin introuvable.");
    }

    /* -------------------------------
     * Variable CORRECTEMENT typée
     -------------------------------- */
    let patientForCsvCheck: Patient | null = null;

    /* -------------------------------
     * Cas PROCHE
     -------------------------------- */
    if (procheId) {
      const proche = await this.prisma.proche.findUnique({
        where: { id: procheId },
        include: { patient: true },
      });

      if (!proche) {
        throw new NotFoundException("Proche introuvable.");
      }

      patientForCsvCheck = proche.patient;

      return this.prisma.document.create({
        data: {
          type,
          url,
          filename,
          medecin: { connect: { id: medecinId } },
          proche: { connect: { id: procheId } },
        },
      });
    }

    /* -------------------------------
     * Cas PATIENT
     -------------------------------- */
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId! },
      select: {
        id: true,
        nom: true,
        prenom: true,
        dateNaissance: true,
      },
    });

    if (!patient) {
      throw new NotFoundException("Patient introuvable.");
    }

    patientForCsvCheck = patient as Patient;

    /* -------------------------------
     * CSV gate si nouveaux patients refusés
     -------------------------------- */
    if (!medecin.accepteNouveauxPatients && patientForCsvCheck) {
      const rows = await this.prisma.medecinPatientCSV.findMany({
        where: { medecinId },
      });

      const ok = rows.some((row) =>
        identitiesMatch(
          row.nom,
          row.prenom,
          row.dateNaissance,
          patientForCsvCheck!.nom,
          patientForCsvCheck!.prenom,
          patientForCsvCheck!.dateNaissance,
        )
      );

      if (!ok) {
        throw new ForbiddenException(
          "Ce patient n'est pas autorisé par le CSV du médecin."
        );
      }
    }

    return this.prisma.document.create({
      data: {
        type,
        url,
        filename,
        medecin: { connect: { id: medecinId } },
        patient: { connect: { id: patientId! } },
      },
    });
  }

  /* =========================================================
   * LISTE DOCUMENTS POUR UN PATIENT
   ========================================================= */
  async findByPatient(patientId: number) {
    return this.prisma.document.findMany({
      where: {
        OR: [{ patientId }, { proche: { patientId } }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        medecin: {
          select: { id: true, nom: true, prenom: true },
        },
        proche: {
          select: { id: true, prenom: true, nom: true, relation: true },
        },
      },
    });
  }

  /* =========================================================
   * DELETE DOCUMENT (DB + FICHIER)
   ========================================================= */
  async remove(documentId: number) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, url: true },
    });

    if (!doc) {
      throw new NotFoundException("Document introuvable.");
    }

    try {
      const match = doc.url?.match(/\/uploads\/([^/?#]+)/);
      const filename = match?.[1];
      if (filename) {
        const filePath = path.join(process.cwd(), "uploads", filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch {
      // best effort
    }

    await this.prisma.document.delete({
      where: { id: documentId },
    });

    return { success: true };
  }
}
