import { IsOptional, IsString, IsNumberString } from "class-validator";

export class SearchMedecinDto {
  @IsOptional()
  @IsString()
  specialite?: string;

  @IsOptional()
  @IsNumberString()
  rayon?: string; // km

  @IsOptional()
  @IsNumberString()
  lat?: string;

  @IsOptional()
  @IsNumberString()
  lng?: string;

  @IsOptional()
  @IsNumberString()
  noteMin?: string;

  @IsOptional()
  @IsNumberString()
  delaiMax?: string; // en jours

  @IsOptional()
  @IsNumberString()
  patientId?: string; // pour trier par distance
}
