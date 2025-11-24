import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  ValidateIf,
} from "class-validator";

export class CreateRdvDto {
  @IsNotEmpty()
  @IsDateString()
  date: string; // format YYYY-MM-DD

  @IsNotEmpty()
  @IsString()
  heure: string; // format HH:mm

  @IsOptional()
  @IsString()
  motif?: string | null;

  // Patient peut être null (créneau libre ou bloqué)
  @ValidateIf((o) => o.patientId !== null && o.patientId !== undefined)
  @IsInt()
  patientId?: number | null;

  @IsInt()
  medecinId: number;
}
