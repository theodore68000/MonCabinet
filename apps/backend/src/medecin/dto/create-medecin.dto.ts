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
  horaires?: any;

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
