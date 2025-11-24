import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Controller('conversations')
export class ConversationController {
  constructor(private readonly service: ConversationService) {}

  /**
   * Créer une nouvelle conversation
   */
  @Post()
  create(@Body() dto: CreateConversationDto) {
    return this.service.create(dto);
  }

  /**
   * Récupérer toutes les conversations d’un médecin
   */
  @Get('medecin/:id')
  getForMedecin(@Param('id', ParseIntPipe) id: number) {
    return this.service.getForMedecin(id);
  }

  /**
   * Ajouter un membre dans une conversation existante
   */
  @Post(':id/add-member')
  addMember(
    @Param('id', ParseIntPipe) conversationId: number,
    @Body() dto: AddMemberDto,
  ) {
    return this.service.addMember(conversationId, dto);
  }
}
