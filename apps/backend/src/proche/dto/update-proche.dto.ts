import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class UpdateProcheDto {
  @IsOptional()
  @IsString()
  prenom?: string;

  @IsOptional()
  @IsString()
  nom?: string;

  /**
   * Compat (front actuel)
   */
  @IsOptional()
  @IsInt()
  anneeNaissance?: number;

  /**
   * Format métier : dd/mm/yyyy
   */
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'dateNaissance doit être au format dd/mm/yyyy',
  })
  dateNaissance?: string;

  @IsOptional()
  @IsString()
  relation?: string;

  @IsOptional()
  @IsString()
  notesSante?: string;
}
