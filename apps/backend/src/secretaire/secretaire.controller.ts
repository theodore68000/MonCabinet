import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { SecretaireService } from './secretaire.service';
import { UpdateSecretaireDto } from './dto/update-secretaire.dto';
import { CreateSecretaireDto } from './dto/create-secretaire.dto';

@Controller('secretaire')
export class SecretaireController {
  constructor(private readonly secretaireService: SecretaireService) {}

  // ─────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────
  @Post('login')
  login(@Body() dto: { email: string; motDePasse: string }) {
    return this.secretaireService.login(dto.email, dto.motDePasse);
  }

  // ─────────────────────────────────────────
  // CREATE SECRETAIRE (PAR MEDECIN)
  // ─────────────────────────────────────────
  @Post('create/:medecinId')
  create(
    @Param('medecinId') medecinId: string,
    @Body() dto: CreateSecretaireDto,
  ) {
    return this.secretaireService.create(Number(medecinId), dto);
  }

  // ─────────────────────────────────────────
  // PROFIL SECRETAIRE
  // ─────────────────────────────────────────
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.secretaireService.findOne(Number(id));
  }

  // ─────────────────────────────────────────
  // UPDATE PROFIL
  // ─────────────────────────────────────────
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSecretaireDto) {
    return this.secretaireService.update(Number(id), dto);
  }

  // ─────────────────────────────────────────
  // MEDECINS LIÉS À LA SECRETAIRE
  // ─────────────────────────────────────────
  @Get(':id/medecins')
  getMedecins(@Param('id') id: string) {
    return this.secretaireService.getMedecins(Number(id));
  }
}
