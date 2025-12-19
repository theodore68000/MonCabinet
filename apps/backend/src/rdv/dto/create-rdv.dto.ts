import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsIn,
  IsInt,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PatientIdentityDto {
  @IsNotEmpty()
  @IsIn(['CSV', 'HORS'])
  source: 'CSV' | 'HORS';

  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  prenom?: string;

  // JJ/MM/AAAA (pas ISO)
  @IsOptional()
  @IsString()
  dateNaissance?: string;
}

export class CreateRdvDto {
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @IsNotEmpty()
  @IsString()
  heure: string;

  @IsOptional()
  @IsString()
  motif?: string | null;

  @IsOptional()
  @IsInt()
  patientId?: number | null;

  @IsOptional()
  @IsInt()
  procheId?: number | null;

  @IsNotEmpty()
  @IsInt()
  medecinId: number;

  @IsOptional()
  @IsIn(['PRESENTIEL', 'VISIO'])
  typeConsultation?: 'PRESENTIEL' | 'VISIO';

  @IsOptional()
  @IsIn(['LIBRE', 'PRIS', 'BLOQUE', 'HORS'])
  typeSlot?: 'LIBRE' | 'PRIS' | 'BLOQUE' | 'HORS';

  // ✅ AJOUT — identité patient (CSV ou HORS)
  @IsOptional()
  @ValidateNested()
  @Type(() => PatientIdentityDto)
  patientIdentity?: PatientIdentityDto;
}
