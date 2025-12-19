import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateFormulaireDto {
  @IsString()
  symptomes: string;

  @IsOptional()
  @IsString()
  debutSymptomes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  douleur?: number;

  @IsOptional()
  @IsString()
  antecedents?: string;

  @IsOptional()
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsString()
  medicaments?: string;

  @IsOptional()
  @IsString()
  grossesse?: string;

  @IsOptional()
  @IsString()
  questions?: string;
}
