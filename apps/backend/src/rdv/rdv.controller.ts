import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from "@nestjs/common";
import { RdvService } from "./rdv.service";
import { CreateRdvDto } from "./dto/create-rdv.dto";
import { UpdateRdvDto } from "./dto/update-rdv.dto";

@Controller("rdv")
export class RdvController {
  constructor(private readonly rdvService: RdvService) {}

  // Création d'un RDV (médecin)
  @Post()
  create(@Body() dto: CreateRdvDto) {
    return this.rdvService.create(dto);
  }

  // Création d'un RDV par un patient (optionnel, pour plus tard)
  @Post("patient")
  createForPatient(@Body() dto: CreateRdvDto) {
    return this.rdvService.createForPatient(dto);
  }

  @Get()
  findAll(
    @Query("medecinId") medecinId?: string,
    @Query("patientId") patientId?: string,
  ) {
    return this.rdvService.findAll(
      medecinId ? Number(medecinId) : undefined,
      patientId ? Number(patientId) : undefined,
    );
  }

  @Get("medecin/:medecinId")
  getByMedecinAndPeriod(
    @Param("medecinId") medecinId: string,
    @Query("start") start: string,
    @Query("end") end: string,
  ) {
    return this.rdvService.getByMedecinAndPeriod(
      Number(medecinId),
      start,
      end,
    );
  }

  @Get("disponibilites")
  getDisponibilites(
    @Query("medecinId") medecinId: string,
    @Query("date") date: string,
  ) {
    return this.rdvService.getDisponibilites(Number(medecinId), date);
  }

  // Création d’un créneau libre
  @Post("slot")
  createSlot(@Body() body: { medecinId: number; date: string; heure: string }) {
    return this.rdvService.createSlot(body);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.rdvService.findOne(Number(id));
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateRdvDto) {
    return this.rdvService.update(Number(id), dto);
  }

  // ❗Suppression logique : on bloque le créneau (statut = "indisponible")
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.rdvService.remove(Number(id));
  }
}
