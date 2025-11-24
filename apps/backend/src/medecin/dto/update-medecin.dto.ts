// src/medecin/dto/update-medecin.dto.ts

import {
  IsOptional,
  IsString,
  IsBoolean,
  IsEmail,
} from 'class-validator';

export class UpdateMedecinDto {

  // ❌ Non modifiable : nom, prénom, id

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  motDePasse?: string; // ✔ modifiable

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  specialite?: string;

  @IsOptional()
  @IsString()
  adresseCabinet?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  horaires?: any;

  @IsOptional()
  @IsBoolean()
  accepteNouveauxPatients?: boolean;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  typeExercice?: string;

  @IsOptional()
  @IsString()
  siret?: string;

  @IsOptional()
  @IsString()
  adresseFacturation?: string;

  @IsOptional()
  @IsString()
  statut?: string; // ✔ modifiable

  // ❌ Non modifiable : rpps, cabinetId, resetToken, resetExpires
}
