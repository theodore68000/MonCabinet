import {
  IsEmail,
  IsOptional,
  IsString,
  IsInt,
  Matches,
} from 'class-validator';

export class CreatePatientDto {
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
  adresse?: string;

  /**
   * ❌ Déprécié – conservé pour compat éventuelle
   */
  @IsOptional()
  @IsInt()
  anneeNaissance?: number;

  /**
   * ✅ Format API attendu : dd/mm/yyyy
   * → sera converti en YYYY-MM-DD côté service
   */
  @IsString()
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'dateNaissance doit être au format dd/mm/yyyy',
  })
  dateNaissance: string;

  @IsOptional()
  @IsInt()
  medecinTraitantId?: number;
}
