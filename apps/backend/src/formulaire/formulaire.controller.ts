import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';

import { FormulaireService } from './formulaire.service';
import { CreateFormulaireDto } from './dto/create-formulaire.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('formulaire')
export class FormulaireController {
  constructor(
    private readonly formulaireService: FormulaireService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 📌 GET /formulaire/:rdvId
   * Retourne formulaire + RDV + patient + médecin
   */
  @Get(':rdvId')
  async getFormulaire(@Param('rdvId', ParseIntPipe) rdvId: number) {
    const form = await this.prisma.formulairePreconsultation.findUnique({
      where: { rdvId },
      include: {
        rdv: {
          include: {
            patient: true,
            medecin: true,
          },
        },
      },
    });

    if (!form) throw new NotFoundException('Formulaire introuvable');
    return form;
  }

  /**
   * 📌 POST /formulaire/:rdvId
   * Le patient remplit le formulaire.
   * On stocke directement toutes les propriétés du DTO dans `reponses`.
   */
  @Post(':rdvId')
  async updateFormulaire(
    @Param('rdvId', ParseIntPipe) rdvId: number,
    @Body() dto: CreateFormulaireDto,
  ) {
    if (!dto) {
      throw new NotFoundException('Aucune donnée envoyée');
    }

    // DTO → enregistré comme bloc JSON
    return this.formulaireService.updateFormulaire(rdvId, dto);
  }
}
