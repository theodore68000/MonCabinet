// apps/backend/src/schedule-reference/schedule-reference.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Patch,
} from '@nestjs/common';
import { ScheduleReferenceService } from './schedule-reference.service';

@Controller('schedule-reference')
export class ScheduleReferenceController {
  constructor(private readonly scheduleRef: ScheduleReferenceService) {}

  /**
   * Générateur ONE-SHOT de planning
   *
   * - enregistre la structure envoyée
   * - génère des créneaux LIBRES réels sur 1 an
   * - n'impose PLUS RIEN après la génération
   * - aucune logique virtuelle
   */
  @Patch(':medecinId')
  async updateHorairesReference(
    @Param('medecinId') medecinId: string,
    @Body()
    body: {
      horairesReference: Record<string, string[]>;
    },
  ) {
    const id = Number(medecinId);

    if (isNaN(id)) {
      throw new BadRequestException('medecinId invalide.');
    }

    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Body invalide.');
    }

    if (!body.horairesReference || typeof body.horairesReference !== 'object') {
      throw new BadRequestException('horairesReference obligatoire.');
    }

    return this.scheduleRef.updateHorairesReference(
      id,
      body.horairesReference,
    );
  }
}
