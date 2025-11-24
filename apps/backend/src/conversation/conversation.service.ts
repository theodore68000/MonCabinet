import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Injectable()
export class ConversationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Créer une conversation (privée ou groupe)
   */
  async create(dto: CreateConversationDto) {
    // Vérifier que les médecins existent
    const medecins = await this.prisma.medecin.findMany({
      where: { id: { in: dto.participantIds } },
    });

    if (medecins.length !== dto.participantIds.length) {
      throw new NotFoundException('Un des médecins est introuvable.');
    }

    // Vérifier qu'ils sont dans le même cabinet
    for (const m of medecins) {
      if (m.cabinetId !== dto.cabinetId) {
        throw new NotFoundException(
          'Tous les médecins doivent appartenir au même cabinet.',
        );
      }
    }

    // Création
    const conv = await this.prisma.conversation.create({
      data: {
        name: dto.name ?? null,
        cabinetId: dto.cabinetId,
        participants: {
          create: dto.participantIds.map((id) => ({ medecinId: id })),
        },
      },
    });

    // Retourner la conversation complétée (comme attendu par ton front)
    return this.prisma.conversation.findUnique({
      where: { id: conv.id },
      include: {
        participants: {
          include: { medecin: true },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { from: true },
        },
      },
    });
  }

  /**
   * Récupérer toutes les conversations d'un médecin
   */
  async getForMedecin(medecinId: number) {
    return this.prisma.conversation.findMany({
      where: {
        participants: {
          some: { medecinId },
        },
      },
      include: {
        participants: {
          include: { medecin: true },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { from: true },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Ajouter un membre dans un groupe
   */
  async addMember(conversationId: number, dto: AddMemberDto) {
    // Vérifier que la conversation existe
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conv) {
      throw new NotFoundException('Conversation introuvable.');
    }

    // Vérifier que le médecin existe
    const med = await this.prisma.medecin.findUnique({
      where: { id: dto.medecinId },
    });

    if (!med) {
      throw new NotFoundException('Médecin introuvable.');
    }

    return this.prisma.conversationParticipant.create({
      data: {
        conversationId,
        medecinId: dto.medecinId,
      },
    });
  }

  /**
   * Vérifier qu'un médecin appartient à une conversation
   */
  async checkMember(conversationId: number, medecinId: number) {
    const exists = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, medecinId },
    });

    return !!exists;
  }
}
