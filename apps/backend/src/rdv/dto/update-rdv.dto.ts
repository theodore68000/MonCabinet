import { PartialType } from '@nestjs/mapped-types';
import {
  IsOptional,
  IsIn,
  IsInt,
  IsString,
  IsBoolean,
} from 'class-validator';
import { CreateRdvDto } from './create-rdv.dto';

export class UpdateRdvDto extends PartialType(CreateRdvDto) {
  @IsOptional()
  @IsInt()
  patientId?: number | null;

  @IsOptional()
  @IsInt()
  procheId?: number | null;

  @IsOptional()
  @IsString()
  motif?: string | null;

  @IsOptional()
  @IsIn(['LIBRE', 'PRIS', 'BLOQUE', 'HORS'])
  typeSlot?: 'LIBRE' | 'PRIS' | 'BLOQUE' | 'HORS';

  @IsOptional()
  @IsInt()
  medecinId?: number;

  // ✅ Autorisé uniquement pour actions médecin
  // (le service doit refuser toute modif patient)
  @IsOptional()
  @IsBoolean()
  formulaireDemande?: boolean;
}
