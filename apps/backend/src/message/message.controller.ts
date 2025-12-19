// apps/backend/src/message/message.controller.ts

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express'; // ← FIX ICI

@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    return {
      name: file.originalname,
      url: `/uploads/${file.filename}`,
      size: file.size,
      type: file.mimetype,
    };
  }

  @Post()
  create(@Body() dto: CreateMessageDto & { fichiers?: any[] }) {
    return this.messageService.create(dto);
  }

  @Get('conversation/:id')
  getMessagesByConversation(@Param('id', ParseIntPipe) id: number) {
    return this.messageService.getMessagesByConversation(id);
  }
}
