import { IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateRdvDto {
  @IsNotEmpty()
  @IsString()
  date: string; // format YYYY-MM-DD

  @IsNotEmpty()
  @IsString()
  heure: string; // format HH:mm

  @IsOptional()
  @IsString()
  motif?: string;

  @IsInt()
  patientId: number;

  @IsInt()
  medecinId: number;
}
