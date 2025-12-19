import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PaiementService } from './paiement.service';

class CreateIntentDto {
  rendezVousId: number;
}

// TODO: remplace par ton vrai guard patient
class PatientAuthGuard {}

@Controller('paiement')
export class PaiementController {
  constructor(private readonly paiementService: PaiementService) {}

  @Post('create-intent-visio')
  @UseGuards(PatientAuthGuard as any)
  async createIntentVisio(@Body() body: CreateIntentDto, @Req() req: any) {
    const patientId = req.user.id as number;
    const rendezVousId = Number(body.rendezVousId);

    const result =
      await this.paiementService.createOrGetPaymentIntentForRdvVisio(
        rendezVousId,
        patientId,
      );

    return result; // { alreadyPaid, clientSecret }
  }

  @Get('status/:rdvId')
  @UseGuards(PatientAuthGuard as any)
  async getStatus(@Param('rdvId') rdvId: string, @Req() req: any) {
    const patientId = req.user.id as number;
    return this.paiementService.getPaymentStatusForRdv(
      Number(rdvId),
      patientId,
    );
  }
}
