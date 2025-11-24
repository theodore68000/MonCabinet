import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @Type(() => Number)
  @IsInt()
  cabinetId: number;

  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  participantIds: number[];
}
