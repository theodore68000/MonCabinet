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

  @Post()
  create(@Body() dto: CreateRdvDto) {
    return this.rdvService.create(dto);
  }

  @Get()
  findAll(
    @Query("medecinId") medecinId?: string,
    @Query("patientId") patientId?: string
  ) {
    return this.rdvService.findAll(
      medecinId ? Number(medecinId) : undefined,
      patientId ? Number(patientId) : undefined
    );
  }

  @Get("/disponibilites")
  getDisponibilites(
    @Query("medecinId") medecinId: string,
    @Query("date") date: string
  ) {
    return this.rdvService.getDisponibilites(Number(medecinId), date);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.rdvService.findOne(Number(id));
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateRdvDto) {
    return this.rdvService.update(Number(id), dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.rdvService.remove(Number(id));
  }
}
