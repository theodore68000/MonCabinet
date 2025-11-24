// apps/backend/src/message/dto/create-message.dto.ts
import { IsInt, IsString } from 'class-validator';

export class CreateMessageDto {
  @IsInt()
  fromId: number;

  @IsInt()
  conversationId: number;

  @IsString()
  contenu: string;
}
