import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { RdvService } from './rdv.service';
import { CreateRdvDto } from './dto/create-rdv.dto';
import { UpdateRdvDto } from './dto/update-rdv.dto';
import { RDV_MOTIFS } from './constants/motifs.constants';

@Controller('rdv')
export class RdvController {
  constructor(private readonly rdvService: RdvService) {}

  // ───────────────────────────────────────────
  // 📌 Liste RDV (filtrable médecin / patient / proche)
  // ───────────────────────────────────────────
  @Get()
  findAll(
    @Query('medecinId') medecinId?: string,
    @Query('patientId') patientId?: string,
    @Query('procheId') procheId?: string,
  ) {
    const medId = medecinId ? Number(medecinId) : undefined;
    const patId = patientId ? Number(patientId) : undefined;
    const proId = procheId ? Number(procheId) : undefined;

    if (medId !== undefined && isNaN(medId)) {
      throw new BadRequestException('medecinId doit être un nombre.');
    }
    if (patId !== undefined && isNaN(patId)) {
      throw new BadRequestException('patientId doit être un nombre.');
    }
    if (proId !== undefined && isNaN(proId)) {
      throw new BadRequestException('procheId doit être un nombre.');
    }

    return this.rdvService.findAll(medId, patId, proId);
  }


  @Get('motifs')
getMotifs() {
  return RDV_MOTIFS;
}
  // ───────────────────────────────────────────
  // 📌 Création RDV (médecin)
  // ───────────────────────────────────────────
  @Post()
  create(@Body() dto: CreateRdvDto) {
    return this.rdvService.create(dto);
  }
  // ───────────────────────────────────────────
  // 📌 Création slot libre / bloqué / hors horaires
  // ───────────────────────────────────────────
  @Post('slot')
  async createSlot(@Body() dto: CreateRdvDto) {
    if (!dto.medecinId) {
      throw new BadRequestException('medecinId obligatoire.');
    }

    const medecinId = Number(dto.medecinId);
    if (isNaN(medecinId)) {
      throw new BadRequestException('medecinId doit être un nombre.');
    }

    if (!dto.date) {
      throw new BadRequestException('date obligatoire.');
    }
    if (!dto.heure) {
      throw new BadRequestException('heure obligatoire.');
    }

    const rdv = await this.rdvService.createSlot({
      medecinId,
      date: dto.date,
      heure: dto.heure,
      typeSlot: dto.typeSlot
        ? (dto.typeSlot.toString().toUpperCase() as any)
        : 'LIBRE',
    });

    return { rdv };
  }

  // ───────────────────────────────────────────
  // 📌 Création RDV par patient
  // ───────────────────────────────────────────
  @Post('patient')
  createForPatient(@Body() dto: CreateRdvDto) {
    return this.rdvService.createForPatient(dto);
  }

  // ───────────────────────────────────────────
  // 📌 Upload / replace total d’un créneau (médecin)
  // ───────────────────────────────────────────
  @Post('upload/medecin')
  uploadReplaceForMedecin(@Body() dto: CreateRdvDto) {
    return this.rdvService.uploadReplaceForMedecin(dto);
  }

  // ───────────────────────────────────────────
  // 📌 Can book (règle métier)
  // ───────────────────────────────────────────
  @Get('can-book')
  canBook(
    @Query('medecinId') medecinId: string,
    @Query('patientId') patientId?: string,
    @Query('procheId') procheId?: string,
  ) {
    return this.rdvService.canBook(
      Number(medecinId),
      patientId ? Number(patientId) : undefined,
      procheId ? Number(procheId) : undefined,
    );
  }

  // ───────────────────────────────────────────
  // 📌 Suppression RDV par patient
  // (implémentée en delete + create LIBRE côté service)
  // ───────────────────────────────────────────
  @Delete('patient/:id')
  removeForPatient(@Param('id') id: string) {
    const rdvId = Number(id);
    if (isNaN(rdvId)) {
      throw new BadRequestException('id doit être un nombre.');
    }
    return this.rdvService.remove(rdvId, 'patient');
  }

  // ───────────────────────────────────────────
  // 📌 RDV patient (futurs / passés)
  // ───────────────────────────────────────────
  @Get('patient/:patientId')
  getForPatient(
    @Param('patientId') patientId: string,
    @Query('type') type: 'futurs' | 'passes' = 'futurs',
  ) {
    const id = Number(patientId);
    if (isNaN(id)) {
      throw new BadRequestException('patientId invalide.');
    }

    return this.rdvService.getForPatient(id, type);
  }

  // ───────────────────────────────────────────
  // 📌 Planning médecin (jour / semaine)
  // ───────────────────────────────────────────
  @Get('medecin/:id')
  getByMedecin(
    @Param('id') id: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.rdvService.getByMedecinAndPeriod(
      Number(id),
      new Date(start),
      new Date(end),
    );
  }

  // ───────────────────────────────────────────
  // 📌 Disponibilités patient
  // ───────────────────────────────────────────
  @Get('disponibilites')
  getDisponibilites(
    @Query('medecinId') medecinId: string,
    @Query('date') date: string,
    @Query('patientId') patientId?: string,
    @Query('procheId') procheId?: string,
  ) {
    return this.rdvService.getDisponibilites(
      Number(medecinId),
      date,
      patientId ? Number(patientId) : undefined,
      procheId ? Number(procheId) : undefined,
    );
  }

  // ───────────────────────────────────────────
  // 📌 Planning cabinet (vue secrétaire)
  // ───────────────────────────────────────────
  @Get('cabinet/:cabinetId/day')
  getPlanningCabinetForDay(
    @Param('cabinetId') cabinetId: string,
    @Query('date') date: string,
  ) {
    const cabId = Number(cabinetId);
    if (isNaN(cabId)) {
      throw new BadRequestException('cabinetId doit être un nombre.');
    }
    if (!date) {
      throw new BadRequestException('date obligatoire.');
    }
    return this.rdvService.getPlanningForCabinetDay(cabId, date);
  }

  // ───────────────────────────────────────────
  // 📌 Détail RDV
  // ───────────────────────────────────────────
  @Get(':id')
  findOne(@Param('id') id: string) {
    const rdvId = Number(id);
    if (isNaN(rdvId)) {
      throw new BadRequestException('id doit être un nombre.');
    }
    return this.rdvService.findOne(rdvId);
  }

  // ───────────────────────────────────────────
  // 📅 META planning médecin (lecture seule)
  // ───────────────────────────────────────────
  @Get('medecin/:id/planning-meta')
  async getMedecinPlanningMeta(@Param('id') id: string) {
    const medecinId = Number(id);
    if (isNaN(medecinId)) {
      throw new BadRequestException('medecinId invalide.');
    }

    return this.rdvService.getMedecinPlanningMeta(medecinId);
  }

  // ───────────────────────────────────────────
  // 📌 Update RDV (médecin)
  // (implémenté en delete + create côté service)
  // ───────────────────────────────────────────
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRdvDto) {
    const rdvId = Number(id);
    if (isNaN(rdvId)) {
      throw new BadRequestException('id doit être un nombre.');
    }
    return this.rdvService.update(rdvId, dto, 'medecin');
  }

  // ───────────────────────────────────────────
  // 📌 Update RDV (secrétaire)
  // ───────────────────────────────────────────
  @Patch(':id/secretaire')
  updateBySecretaire(@Param('id') id: string, @Body() dto: UpdateRdvDto) {
    const rdvId = Number(id);
    if (isNaN(rdvId)) {
      throw new BadRequestException('id doit être un nombre.');
    }
    return this.rdvService.update(rdvId, dto, 'secretaire');
  }

  // ───────────────────────────────────────────
  // 📌 Swap RDV (médecin)
  // ───────────────────────────────────────────
  @Patch('swap/medecin')
  swapByMedecin(
    @Body() body: { firstId: number | string; secondId: number | string },
  ) {
    const firstId = Number(body.firstId);
    const secondId = Number(body.secondId);

    if (isNaN(firstId) || isNaN(secondId)) {
      throw new BadRequestException('IDs invalides.');
    }

    return this.rdvService.swapSlots(firstId, secondId, 'medecin');
  }

  // ───────────────────────────────────────────
  // 📌 Swap RDV (secrétaire)
  // ───────────────────────────────────────────
  @Patch('swap/secretaire')
  swapBySecretaire(
    @Body() body: { firstId: number | string; secondId: number | string },
  ) {
    const firstId = Number(body.firstId);
    const secondId = Number(body.secondId);

    if (isNaN(firstId) || isNaN(secondId)) {
      throw new BadRequestException('IDs invalides.');
    }

    return this.rdvService.swapSlots(firstId, secondId, 'secretaire');
  }

  // ───────────────────────────────────────────
  // 📌 Move RDV (secrétaire)
  // ───────────────────────────────────────────
  @Post('move/secretaire')
  moveForSecretaire(
    @Body()
    body: {
      rdvId: number;
      toDate: string;
      toHour: string;
      toMedecinId: number;
    },
  ) {
    return this.rdvService.moveRdvForSecretaire(body);
  }

  // ───────────────────────────────────────────
  // 📌 Vue journée exhaustive (drawer)
  // ───────────────────────────────────────────
  @Get('medecin/:id/day')
  getDaySchedule(
    @Param('id') id: string,
    @Query('date') date: string,
  ) {
    const medecinId = Number(id);
    if (isNaN(medecinId)) {
      throw new BadRequestException('medecinId invalide.');
    }
    if (!date) {
      throw new BadRequestException('date obligatoire.');
    }

    return this.rdvService.getDaySchedule(medecinId, date);
  }

  // ───────────────────────────────────────────
  // 📌 Delete HARD (technique)
  // ───────────────────────────────────────────
  @Delete(':id/hard')
  removeHard(@Param('id') id: string) {
    const rdvId = Number(id);
    return this.rdvService.deleteSlotHard(rdvId);
  }

  // ───────────────────────────────────────────
  // 📌 Apply schedule interval
  // ───────────────────────────────────────────
@Post('schedule/apply')
applySchedule(
  @Body()
  body: {
    medecinId: number;
    date: string;
    start: string;
    end: string;
    typeSlot?: 'LIBRE' | 'BLOQUE';
    deleteOnly?: boolean;
  },
) {
  return this.rdvService.applyScheduleInterval(body);
}


  // ───────────────────────────────────────────
  // 📌 Annulation RDV (médecin)
  // ───────────────────────────────────────────


  // ───────────────────────────────────────────
  // 📌 Annulation RDV (secrétaire)
  // ───────────────────────────────────────────
  @Delete(':id/secretaire')
  removeBySecretaire(@Param('id') id: string) {
    const rdvId = Number(id);
    if (isNaN(rdvId)) {
      throw new BadRequestException('id doit être un nombre.');
    }
    return this.rdvService.remove(rdvId, 'secretaire');
  }

  // ───────────────────────────────────────────
  // 📌 Swap vue cabinet
  // ───────────────────────────────────────────
  @Patch('swap/medecin-view')
  swapByMedecinView(
    @Body() body: { firstId: number | string; secondId: number | string },
  ) {
    const firstId = Number(body.firstId);
    const secondId = Number(body.secondId);

    if (isNaN(firstId) || isNaN(secondId)) {
      throw new BadRequestException('IDs invalides.');
    }

    return this.rdvService.swapByMedecinView(firstId, secondId);
  }

  // ───────────────────────────────────────────
  // 📌 Move RDV (médecin)
  // ───────────────────────────────────────────
  @Post('move/medecin')
  moveForMedecin(
    @Body()
    body: {
      rdvId: number;
      toDate: string;
      toHour: string;
      medecinId: number;
    },
  ) {
    return this.rdvService.moveRdvForMedecin(body);
  }

  @Delete(':id')
  deleteHard(@Param('id') id: string) {
  const rdvId = Number(id);
  if (isNaN(rdvId)) {
    throw new BadRequestException('id invalide.');
  }
  return this.rdvService.deleteHard(rdvId);
}

}
