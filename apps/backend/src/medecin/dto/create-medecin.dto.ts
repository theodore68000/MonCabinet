import {
  IsEmail,
  IsOptional,
  IsString,
  IsBoolean,
  IsJSON,
  IsNumber,
} from 'class-validator';

export class CreateMedecinDto {
  @IsString()
  nom: string;

  @IsString()
  prenom: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  motDePasse?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  specialite?: string;

  // 🔥 Nouveau champs (1 → 6)

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
  statut?: string; // en_attente, actif, refuse

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsJSON()
  horaires?: any; // JSON

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
  @IsNumber()
  cabinetId?: number;
}
