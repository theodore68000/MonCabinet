import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
} from '@nestjs/common';
import { PatientService } from './patient.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { RdvService } from 'src/rdv/rdv.service';
import { CreateRdvDto } from 'src/rdv/dto/create-rdv.dto';

@Controller('patient')
export class PatientController {
  constructor(
    private readonly patientService: PatientService,
    private readonly rdvService: RdvService,
  ) {}

  // ───────────────────────────────────────────────
  // 📌 INSCRIPTION : étape 1 → envoi code
  // ───────────────────────────────────────────────
  @Post()
  create(@Body() createPatientDto: CreatePatientDto) {
    return this.patientService.create(createPatientDto);
  }

  // ───────────────────────────────────────────────
  // 📌 🔥 CRÉATION DIRECTE (SECRÉTAIRE)
  // ───────────────────────────────────────────────
  @Post('admin-create')
  createDirect(@Body() dto: CreatePatientDto) {
    return this.patientService.createDirect(dto);
  }

  // ───────────────────────────────────────────────
  // 📌 LOGIN
  // ───────────────────────────────────────────────
  @Post('login')
  async login(
    @Body() body: { email: string; motDePasse: string },
    @Req() req,
  ) {
    const result = await this.patientService.login(
      body.email,
      body.motDePasse,
    );

    const isSuccess = typeof result === 'object' && 'id' in result;

    req.auditAction = {
      userId: isSuccess ? (result as any).id : null,
      role: 'patient',
      action: isSuccess ? 'login_success' : 'login_failed',
    };

    return result;
  }

  // ───────────────────────────────────────────────
  // 📌 INSCRIPTION : étape 2 → validation email
  // ───────────────────────────────────────────────
  @Post('verify-email')
  verifyEmail(@Body() body: { email: string; code: string }) {
    return this.patientService.verifyEmail(body.email, body.code);
  }

  // ───────────────────────────────────────────────
  // 📌 MOT DE PASSE OUBLIÉ
  // ───────────────────────────────────────────────
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }, @Req() req) {
    req.auditAction = {
      role: 'patient',
      action: 'forgot_password_request',
    };

    return this.patientService.forgotPassword(body.email);
  }

  // ───────────────────────────────────────────────
  // 📌 RESET PASSWORD
  // ───────────────────────────────────────────────
  @Post('reset-password')
  async resetPassword(
    @Body() body: { token: string; motDePasse: string },
    @Req() req,
  ) {
    req.auditAction = {
      role: 'patient',
      action: 'reset_password',
    };

    return this.patientService.resetPassword(
      body.token,
      body.motDePasse,
    );
  }

  // ───────────────────────────────────────────────
  // 📌 LISTE DES PATIENTS
  // ───────────────────────────────────────────────
  @Get()
  async findAll(@Query('medecinId') medecinId?: string) {
    if (!medecinId) return this.patientService.findAll();
    return this.patientService.findAllByMedecin(Number(medecinId));
  }

  // ───────────────────────────────────────────────
  // 📌 RECHERCHE PATIENT (SECRÉTAIRE)
  // ───────────────────────────────────────────────
  @Get('search')
  async searchPatients(
    @Query('query') query: string,
    @Query('secretaireId') secretaireId: string,
  ) {
    return this.patientService.searchPatients(query, Number(secretaireId));
  }

  // ───────────────────────────────────────────────
  // 📌 RÉCUPÉRATION 1 PATIENT
  // ───────────────────────────────────────────────
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query('medecinId') medecinId?: string,
  ) {
    if (!medecinId) return this.patientService.findOne(+id);

    return this.patientService.getOneForMedecin(
      Number(id),
      Number(medecinId),
    );
  }

  // ───────────────────────────────────────────────
  // 📌 🔥 LISTE DES FAVORIS
  // ───────────────────────────────────────────────
  @Get(':id/favoris')
  async getFavoris(@Param('id') id: string) {
    return this.patientService.getFavoris(Number(id));
  }

  // ───────────────────────────────────────────────
  // 📌 🔥 AJOUTER UN FAVORI
  // ───────────────────────────────────────────────
  @Post(':id/favoris')
  async addFavori(
    @Param('id') id: string,
    @Body() body: { medecinId: number },
  ) {
    return this.patientService.addFavori(Number(id), Number(body.medecinId));
  }

  // ───────────────────────────────────────────────
  // 📌 🔥 SUPPRIMER UN FAVORI
  // ───────────────────────────────────────────────
  @Delete(':id/favoris/:medecinId')
  async removeFavori(
    @Param('id') id: string,
    @Param('medecinId') medecinId: string,
  ) {
    return this.patientService.removeFavori(
      Number(id),
      Number(medecinId),
    );
  }

  // ───────────────────────────────────────────────
  // 📌 UPDATE PATIENT
  // ───────────────────────────────────────────────
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePatientDto, @Req() req) {
    req.auditAction = {
      userId: Number(id),
      role: 'patient',
      action: 'patient_profile_update',
      targetType: 'Patient',
      targetId: Number(id),
    };

    return this.patientService.update(+id, dto);
  }

  // ───────────────────────────────────────────────
  // 📌 UPDATE PASSWORD
  // ───────────────────────────────────────────────
  @Patch(':id/password')
  updatePassword(
    @Param('id') id: string,
    @Body() body: { oldPassword: string; newPassword: string },
    @Req() req,
  ) {
    req.auditAction = {
      userId: Number(id),
      role: 'patient',
      action: 'change_password',
      targetType: 'Patient',
      targetId: Number(id),
    };

    return this.patientService.updatePassword(
      Number(id),
      body.oldPassword,
      body.newPassword,
    );
  }

  // ───────────────────────────────────────────────
  // 📌 DELETE PATIENT
  // ───────────────────────────────────────────────
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req) {
    req.auditAction = {
      userId: Number(id),
      role: 'patient',
      action: 'patient_removed',
      targetType: 'Patient',
      targetId: Number(id),
    };

    return this.patientService.remove(+id);
  }

  @Get(':patientId/can-access-medecin/:medecinId')
async canAccessMedecin(
  @Param('patientId') patientId: string,
  @Param('medecinId') medecinId: string,
) {
  return this.patientService.canAccessMedecin(
    Number(patientId),
    Number(medecinId),
  );
}


  // ───────────────────────────────────────────────
  // 🗓️ RDV — PATIENT (AJOUT SANS SUPPRESSION)
  // ───────────────────────────────────────────────

@Post(':id/rdv')
prendreRdv(
  @Param('id') id: string,
  @Body() dto: CreateRdvDto,
) {
  return this.rdvService.createForPatient({
    ...dto,
    patientId: Number(id),
    procheId: null,
  });
}


  @Get(':id/rdv')
  mesRdvs(@Param('id') id: string) {
    return this.rdvService.getForPatient(Number(id), 'futurs');
  }
}
