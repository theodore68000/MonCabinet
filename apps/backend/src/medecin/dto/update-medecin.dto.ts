import {
  IsOptional,
  IsString,
  IsBoolean,
  IsEmail,
  IsNumber,
} from 'class-validator';

export class UpdateMedecinDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  motDePasse?: string;

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
  statut?: string;

  @IsOptional()
  @IsNumber()
  newId?: number;
}
