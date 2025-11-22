import { IsEmail, IsOptional, IsString, IsInt } from 'class-validator';

export class CreatePatientDto {
  @IsString()
  nom: string;

  @IsString()
  prenom: string;

  @IsEmail()
  email: string;

  @IsString()
  motDePasse: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  adresse?: string;

  @IsOptional()
  @IsInt()
  anneeNaissance?: number;

  @IsOptional()
  @IsInt()
  medecinTraitantId?: number;
}
