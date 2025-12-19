import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsIn, IsInt, IsString } from 'class-validator';
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
}
