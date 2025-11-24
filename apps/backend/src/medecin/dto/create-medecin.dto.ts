// src/medecin/dto/create-medecin.dto.ts
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateMedecinDto {
  @IsString()
  nom: string;

  @IsString()
  prenom: string;

  @IsEmail()
  email: string;

  // 🔐 Mot de passe médecin (obligatoire à la création)
  @IsString()
  motDePasse: string;

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
  rpps?: string;

  @IsOptional()
  @IsBoolean()
  accepteNouveauxPatients?: boolean;

  @IsOptional()
  @IsString()
  statut?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  horaires?: any; // JSON libre

  @IsOptional()
  @IsString()
  bio?: string;

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
  @IsInt()
  cabinetId?: number;
}
