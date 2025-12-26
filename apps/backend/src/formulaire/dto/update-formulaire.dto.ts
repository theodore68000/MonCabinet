import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateFormulaireDto {
  /**
   * Motif du RDV (copie métier pour lecture facile côté médecin)
   */
  @IsString()
  motif: string;

  /**
   * Réponses dynamiques du formulaire (JSON libre)
   */
  @IsObject()
  answers: Record<string, any>;

  /**
   * Optionnel : formulaire marqué comme rempli
   */
  @IsOptional()
  @IsBoolean()
  rempli?: boolean;
}
