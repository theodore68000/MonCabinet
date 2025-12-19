import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateSecretaireDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  prenom?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  motDePasse?: string;
}
