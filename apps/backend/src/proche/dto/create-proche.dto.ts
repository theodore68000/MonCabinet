import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateProcheDto {
  @IsInt()
  patientId: number;

  @IsString()
  prenom: string;

  @IsString()
  nom: string;

  /**
   * ❌ Déprécié – compat uniquement (front actuel)
   */
  @IsOptional()
  @IsInt()
  anneeNaissance?: number;

  /**
   * ✅ Format métier (front): dd/mm/yyyy
   * (Optionnel car le front peut envoyer seulement anneeNaissance)
   */
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'dateNaissance doit être au format dd/mm/yyyy',
  })
  dateNaissance?: string;

  @IsString()
  relation: string;

  @IsOptional()
  @IsString()
  notesSante?: string;
}
