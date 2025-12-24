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

  // ───────────────────────────────────────────
  // 📌 Création RDV (médecin)
  // ───────────────────────────────────────────
  @Post()
  create(@Body() dto: CreateRdvDto) {
    return this.rdvService.create(dto);
  }

  // ───────────────────────────────────────────
  // 📌 Création slot libre / bloqué / hors horaires
  // ✅ FIX : enveloppe la réponse pour le front
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

    // 🔑 CONTRAT FRONT RESPECTÉ
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
// 📌 UPLOAD / REPLACE (médecin) : overwrite total du créneau
// ───────────────────────────────────────────
@Post('upload/medecin')
uploadReplaceForMedecin(@Body() dto: CreateRdvDto) {
  return this.rdvService.uploadReplaceForMedecin(dto);
}

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
  // ───────────────────────────────────────────
  @Delete('patient/:id')
  removeForPatient(@Param('id') id: string) {
    const rdvId = Number(id);
    if (isNaN(rdvId)) {
      throw new BadRequestException('id doit être un nombre.');
    }
    return this.rdvService.remove(rdvId, 'patient');
  }

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
  // 📌 Planning pour 1 médecin (jour / semaine)
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
  // 📌 Calendar patient : slots libres
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
  // 📌 Planning global du cabinet (vue secrétaire)
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
// 📅 META planning médecin (secrétaire)
// → horaires UNIQUEMENT (lecture)
// ───────────────────────────────────────────
@Get('medecin/:id/planning-meta')
async getMedecinPlanningMeta(
  @Param('id') id: string,
) {
  const medecinId = Number(id);
  if (isNaN(medecinId)) {
    throw new BadRequestException('medecinId invalide.');
  }

  const medecin = await this.rdvService['prisma'].medecin.findUnique({
    where: { id: medecinId },
    select: {
      id: true,
      horaires: true, // 🔑 CLEF
    },
  });

  if (!medecin) {
    throw new BadRequestException('Médecin introuvable.');
  }

  return {
    medecinId: medecin.id,
    horaires:
      typeof medecin.horaires === 'string'
        ? JSON.parse(medecin.horaires)
        : medecin.horaires,
  };
}

  // ───────────────────────────────────────────
  // 📌 Update RDV (médecin)
  // ───────────────────────────────────────────
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRdvDto) {
    const rdvId = Number(id);
    if (isNaN(rdvId)) {
      throw new BadRequestException('id doit être un nombre.');
    }
    return (this.rdvService as any).update(rdvId, dto, 'medecin');
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
    return (this.rdvService as any).update(rdvId, dto, 'secretaire');
  }

  // ───────────────────────────────────────────
  // 📌 Swap RDV (médecin)
  // ───────────────────────────────────────────
  @Patch('swap/medecin')
  swapByMedecin(@Body() body: { firstId: number | string; secondId: number | string }) {
    const firstId = Number(body.firstId);
    const secondId = Number(body.secondId);

    if (isNaN(firstId) || isNaN(secondId)) {
      throw new BadRequestException('firstId et secondId doivent être des nombres.');
    }
    if (firstId === secondId) {
      throw new BadRequestException('Les deux RDV doivent être différents.');
    }

    return this.rdvService.swapSlots(firstId, secondId, 'medecin');
  }

  // ───────────────────────────────────────────
  // 📌 Swap RDV (secrétaire)
  // ───────────────────────────────────────────
  @Patch('swap/secretaire')
  swapBySecretaire(@Body() body: { firstId: number | string; secondId: number | string }) {
    const firstId = Number(body.firstId);
    const secondId = Number(body.secondId);

    if (isNaN(firstId) || isNaN(secondId)) {
      throw new BadRequestException('firstId et secondId doivent être des nombres.');
    }
    if (firstId === secondId) {
      throw new BadRequestException('Les deux RDV doivent être différents.');
    }

    return this.rdvService.swapSlots(firstId, secondId, 'secretaire');
  }
  // RDV.CONTROLLER.TS

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
  const rdvId = Number(body.rdvId);
  const toMedecinId = Number(body.toMedecinId);

  if (isNaN(rdvId) || isNaN(toMedecinId)) {
    throw new BadRequestException('rdvId et toMedecinId doivent être des nombres.');
  }

  return this.rdvService.moveRdvForSecretaire({
    rdvId,
    toDate: body.toDate,
    toHour: body.toHour,
    toMedecinId,
  });
}
// ───────────────────────────────────────────
// 📌 Schedule Drawer — vue journée exhaustive
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
    throw new BadRequestException('date obligatoire (YYYY-MM-DD).');
  }

  return this.rdvService.getDaySchedule(medecinId, date);
}
  // RdvController.ts
@Delete(':id/hard')
removeHard(@Param('id') id: string) {
  const rdvId = Number(id);
  return this.rdvService.deleteSlotHard(rdvId);
}
@Post('schedule/apply')
applySchedule(@Body() body: {
  medecinId: number;
  date: string;
  start: string;
  end: string;
}) {
  return this.rdvService.applyScheduleInterval(body);
}

  // ───────────────────────────────────────────
  // 📌 Annulation RDV (médecin)
  // ───────────────────────────────────────────
  @Delete(':id')
  remove(@Param('id') id: string) {
    const rdvId = Number(id);
    if (isNaN(rdvId)) {
      throw new BadRequestException('id doit être un nombre.');
    }
    return this.rdvService.remove(rdvId, 'medecin');
  }

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

// RdvController.ts

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
// 📌 MOVE RDV (médecin) — vers case vide
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
  const rdvId = Number(body.rdvId);
  const medecinId = Number(body.medecinId);

  if (isNaN(rdvId) || isNaN(medecinId)) {
    throw new BadRequestException('rdvId et medecinId doivent être des nombres.');
  }

  return this.rdvService.moveRdvForMedecin({
    rdvId,
    toDate: body.toDate,
    toHour: body.toHour,
    medecinId,
  });
}

}