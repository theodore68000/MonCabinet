// apps/backend/src/message/message.service.ts

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessageService {
  constructor(private prisma: PrismaService) {}

  /**
   * Envoyer un message dans une conversation
   */
  async create(dto: CreateMessageDto) {
    // on tolère la présence d'un champ "fichiers" sans casser si le DTO TS n'est pas encore à jour
    const { fromId, conversationId, contenu, fichiers } = dto as any;

    // Vérifier que la conversation existe
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation introuvable.');
    }

    // Vérifier que le médecin appartient à la conversation
    const isMember = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, medecinId: fromId },
    });

    if (!isMember) {
      throw new ForbiddenException(
        "Ce médecin n'appartient pas à cette conversation.",
      );
    }

    // Créer le message
    return this.prisma.message.create({
      data: {
        contenu,
        fromId,
        conversationId,
        fichiers: fichiers ?? undefined, // Json? dans Prisma (liste d'objets {name,url,size,type}[])
      },
      include: {
        from: true,
      },
    });
  }

  /**
   * Récupérer tous les messages d'une conversation
   */
  async getMessagesByConversation(conversationId: number) {
    // Vérifier que la conversation existe
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation introuvable.');
    }

    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: {
        from: true,
      },
    });
  }
}
