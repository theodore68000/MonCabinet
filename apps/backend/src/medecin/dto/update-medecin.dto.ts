import { PartialType } from '@nestjs/mapped-types';
import { CreateMedecinDto } from './create-medecin.dto';

export class UpdateMedecinDto extends PartialType(CreateMedecinDto) {}
