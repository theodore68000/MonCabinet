// apps/backend/src/message/message.controller.ts

import { Controller, Get, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  // POST /messages → envoyer un message dans une conversation
  @Post()
  create(@Body() dto: CreateMessageDto) {
    return this.messageService.create(dto);
  }

  // GET /messages/conversation/:id → récupérer les messages d'une conversation
  @Get('conversation/:id')
  getMessagesByConversation(@Param('id', ParseIntPipe) id: number) {
    return this.messageService.getMessagesByConversation(id);
  }
}
