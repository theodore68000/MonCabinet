import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateSecretaireDto {
  @IsString()
  nom: string;

  @IsString()
  prenom: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  telephone?: string;
}
