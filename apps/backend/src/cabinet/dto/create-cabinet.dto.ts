import { IsOptional, IsString } from 'class-validator';

export class CreateCabinetDto {
  @IsString()
  nom: string;

  @IsOptional()
  @IsString()
  adresse?: string;
}
