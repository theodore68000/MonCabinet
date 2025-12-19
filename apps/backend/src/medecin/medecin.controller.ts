import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  NotFoundException,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Query, // ✅ AJOUT
} from '@nestjs/common';

import { MedecinService } from './medecin.service';
import { CreateMedecinDto } from './dto/create-medecin.dto';
import { UpdateMedecinDto } from './dto/update-medecin.dto';

import { FileInterceptor } from '@nestjs/platform-express';
import { csvUploadConfig } from '../common/csv-upload.config';

@Controller('medecin')
export class MedecinController {
  constructor(private readonly medecinService: MedecinService) {}

  // ✅ Normalisation JSON/objet
  private normalizeObject(input: any): any {
    if (!input) return {};
    if (typeof input === 'object') return input;
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    }
    return {};
  }

  // ✅ Normalise les clés de jours pour matcher exactement le front (lundi..dimanche)
  private normalizeDayKey(key: string): string {
    if (!key) return key;

    const k = key
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // enlève accents

    // map quelques variantes courantes
    const map: Record<string, string> = {
      lun: 'lundi',
      lundi: 'lundi',
      mar: 'mardi',
      mardi: 'mardi',
      mer: 'mercredi',
      mercredi: 'mercredi',
      jeu: 'jeudi',
      jeudi: 'jeudi',
      ven: 'vendredi',
      vendredi: 'vendredi',
      sam: 'samedi',
      samedi: 'samedi',
      dim: 'dimanche',
      dimanche: 'dimanche',
    };

    return map[k] ?? k;
  }

  // ✅ Normalise un slot en string "HH:MM-HH:MM"
  private normalizeSlot(slot: any): string | null {
    if (!slot) return null;

    // string déjà au bon format (ou proche)
    if (typeof slot === 'string') {
      const s = slot.trim();

      // remplace quelques tirets typographiques
      const cleaned = s.replace(/[–—]/g, '-');

      // accepte "08h00-12h00"
      const hh = cleaned.replace(/h/g, ':');

      // si déjà "HH:MM-HH:MM"
      if (/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(hh)) return hh;

      // sinon on tente d’extraire 2 horaires
      const m = hh.match(/(\d{1,2}:\d{2}).*?(\d{1,2}:\d{2})/);
      if (m) {
        const a = m[1].padStart(5, '0');
        const b = m[2].padStart(5, '0');
        return `${a}-${b}`;
      }

      return null;
    }

    // objets fréquents: {start,end}, {debut,fin}, {from,to}
    if (typeof slot === 'object') {
      const start =
        (slot.start ??
          slot.debut ??
          slot.from ??
          slot.begin ??
          slot.heureDebut) ?? null;
      const end =
        (slot.end ?? slot.fin ?? slot.to ?? slot.stop ?? slot.heureFin) ?? null;

      if (typeof start === 'string' && typeof end === 'string') {
        const a = start.trim().replace(/h/g, ':').padStart(5, '0');
        const b = end.trim().replace(/h/g, ':').padStart(5, '0');
        if (/^\d{2}:\d{2}$/.test(a) && /^\d{2}:\d{2}$/.test(b)) {
          return `${a}-${b}`;
        }
      }

      return null;
    }

    return null;
  }

  // ✅ Normalise horaires pour le front: clés jours + slots "HH:MM-HH:MM"
  private normalizeHorairesForFront(input: any): Record<string, string[]> {
    const obj = this.normalizeObject(input);

    const out: Record<string, string[]> = {
      lundi: [],
      mardi: [],
      mercredi: [],
      jeudi: [],
      vendredi: [],
      samedi: [],
      dimanche: [],
    };

    // si la structure est imbriquée (ex: { horaires: {...} }), on unwrap
    const maybeNested =
      (obj as any).horaires && typeof (obj as any).horaires === 'object'
        ? (obj as any).horaires
        : obj;

    if (!maybeNested || typeof maybeNested !== 'object') return out;

    for (const [rawKey, rawVal] of Object.entries(maybeNested)) {
      const day = this.normalizeDayKey(rawKey);

      if (!(day in out)) {
        // on ignore les clés inconnues plutôt que polluer
        continue;
      }

      const arr = Array.isArray(rawVal) ? rawVal : [];

      const normalizedSlots: string[] = [];
      for (const s of arr) {
        const ns = this.normalizeSlot(s);
        if (ns) normalizedSlots.push(ns);
      }

      out[day] = normalizedSlots;
    }

    return out;
  }

  @Post('login')
  async login(@Body() dto: any) {
    return this.medecinService.login(dto.email, dto.motDePasse);
  }

  @Post()
  create(@Body() createMedecinDto: CreateMedecinDto) {
    return this.medecinService.create(createMedecinDto);
  }

  @Get()
  findAll() {
    return this.medecinService.findAll();
  }

  /**
   * ✅ AJOUT : auto-complétion patients autorisés via CSV du médecin
   * GET /medecin/:id/patients-csv?query=je
   */
  @Get(':id/patients-csv')
  async searchPatientsCsv(
    @Param('id', ParseIntPipe) id: number,
    @Query('query') query: string, // ✅ AJOUT
  ) {
    // on sécurise le param
    const q = (query ?? '').toString();
    return this.medecinService.searchPatientsAllowedByCsv(id, q);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const med = await this.medecinService.findOne(id);

    if (!med) throw new NotFoundException('Médecin introuvable');

    // ✅ source: reference (annuel) sinon legacy
    const source = (med as any).horairesReference ?? (med as any).horaires ?? {};

    // ✅ payload stable pour le front
    const horaires = this.normalizeHorairesForFront(source);

    return {
      id: med.id,
      nom: med.nom,
      prenom: med.prenom,
      email: med.email,
      telephone: med.telephone,
      specialite: med.specialite,
      adresseCabinet: med.adresseCabinet,
      rpps: med.rpps,
      accepteNouveauxPatients: med.accepteNouveauxPatients,
      statut: med.statut,
      photoUrl: med.photoUrl,
      bio: med.bio,
      typeExercice: med.typeExercice,
      siret: med.siret,
      adresseFacturation: med.adresseFacturation,
      cabinetId: med.cabinetId,

      // ✅ Ce champ est celui consommé par dashboard/page/drawer
      horaires,

      // (On n’enlève rien d’autre)
      cabinet: med.cabinet
        ? {
            id: med.cabinet.id,
            nom: med.cabinet.nom,
            medecins: med.cabinet.medecins.map((m) => ({
              id: m.id,
              nom: m.nom,
              prenom: m.prenom,
              photoUrl: m.photoUrl,
              email: m.email,
            })),
          }
        : null,
    };
  }

  @Get(':id/secretaires')
  async getSecretaires(@Param('id', ParseIntPipe) id: number) {
    return this.medecinService.getSecretaires(id);
  }

  @Post(':id/secretaires')
  async createSecretaire(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: any,
  ) {
    return this.medecinService.createSecretaireForMedecin(id, dto);
  }

  @Delete(':id/secretaires/:secretaireId')
  async removeSecretaire(
    @Param('id', ParseIntPipe) id: number,
    @Param('secretaireId', ParseIntPipe) secretaireId: number,
  ) {
    return this.medecinService.removeSecretaireFromMedecin(id, secretaireId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMedecinDto: UpdateMedecinDto,
  ) {
    return this.medecinService.update(id, updateMedecinDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.medecinService.remove(id);
  }

  @Post(':id/import-csv')
  @UseInterceptors(FileInterceptor('file', csvUploadConfig))
  async importCSV(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier CSV reçu.');
    return this.medecinService.importCSV(id, file);
  }

  /* -------------------------------------------------------------
   * SECRÉTAIRES — DÉTAILS
   ------------------------------------------------------------- */
  @Get(':id/secretaires/:secretaireId')
  async getSecretaireDetails(
    @Param('id', ParseIntPipe) id: number,
    @Param('secretaireId', ParseIntPipe) secretaireId: number,
  ) {
    return this.medecinService.getSecretaireDetails(id, secretaireId);
  }

  /* -------------------------------------------------------------
   * SECRÉTAIRES — RESET MDP PROVISOIRE
   ------------------------------------------------------------- */
  @Post(':id/secretaires/:secretaireId/reset-password')
  async resetSecretairePassword(
    @Param('id', ParseIntPipe) id: number,
    @Param('secretaireId', ParseIntPipe) secretaireId: number,
  ) {
    return this.medecinService.resetSecretairePassword(id, secretaireId);
  }

    /**
   * ✅ AJOUT — recherche patients + proches
   * Utilisé pour l’upload de documents côté médecin
   *
   * GET /medecin/:id/patients-et-proches?query=pa
   */
  @Get(':id/patients-et-proches')
  async searchPatientsEtProches(
    @Param('id', ParseIntPipe) id: number,
    @Query('query') query: string,
  ) {
    const q = (query ?? '').toString();
    return this.medecinService.searchPatientsEtProches(id, q);
  }

  /* -------------------------------------------------------------
 * MOT DE PASSE OUBLIÉ — MÉDECIN
 ------------------------------------------------------------- */

@Post('forgot-password')
async forgotPassword(@Body('email') email: string) {
  return this.medecinService.forgotPassword(email);
}

@Post('reset-password/:token')
async resetPassword(
  @Param('token') token: string,
  @Body('motDePasse') motDePasse: string,
) {
  return this.medecinService.resetPasswordWithToken(token, motDePasse);
}



}
