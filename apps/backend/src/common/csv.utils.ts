import * as csvParser from "csv-parse/sync";
import { BadRequestException } from "@nestjs/common";
import { normalize } from "./identity.utils";

export interface CsvPatientRow {
  nom: string;
  prenom: string;
  dateNaissance: string; // YYYY-MM-DD
}

function parseDateDDMMYYYY(
  ddmmyyyy: string,
  line: number,
): string {
  const parts = ddmmyyyy.split("/");

  if (parts.length !== 3) {
    throw new BadRequestException(
      `Ligne ${line} : dateNaissance invalide (${ddmmyyyy}). Format attendu : dd/mm/yyyy`,
    );
  }

  const [dd, mm, yyyy] = parts;

  if (
    dd.length !== 2 ||
    mm.length !== 2 ||
    yyyy.length !== 4 ||
    isNaN(Number(dd)) ||
    isNaN(Number(mm)) ||
    isNaN(Number(yyyy))
  ) {
    throw new BadRequestException(
      `Ligne ${line} : dateNaissance invalide (${ddmmyyyy}).`,
    );
  }

  // Validation réelle de la date (ex: 31/02 interdit)
  const isoDate = `${yyyy}-${mm}-${dd}`;
  const test = new Date(`${isoDate}T12:00:00Z`);

  if (isNaN(test.getTime())) {
    throw new BadRequestException(
      `Ligne ${line} : dateNaissance invalide (${ddmmyyyy}).`,
    );
  }

  return isoDate;
}

export function parseCSVPatients(buffer: Buffer): CsvPatientRow[] {
  const rows = csvParser.parse(buffer.toString("utf8"), {
    delimiter: ",",
    columns: true,
    bom: true,
    trim: true,
    skip_empty_lines: true,
  });

  return rows.map((row: any, i: number) => {
    if (!row.nom || !row.prenom || !row.dateNaissance) {
      throw new BadRequestException(
        `Ligne ${i + 1} invalide : nom, prénom et dateNaissance requis.`,
      );
    }

    return {
      nom: normalize(row.nom),
      prenom: normalize(row.prenom),
      dateNaissance: parseDateDDMMYYYY(row.dateNaissance, i + 1),
    };
  });
}
