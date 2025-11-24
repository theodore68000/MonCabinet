import { PartialType } from "@nestjs/mapped-types";
import { CreateRdvDto } from "./create-rdv.dto";

export class UpdateRdvDto extends PartialType(CreateRdvDto) {
  // On autorise explicitement null
  patientId?: number | null;
  motif?: string | null;
  statut?: string | null;
}
