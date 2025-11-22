import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { MedecinService } from './medecin.service';
import { CreateMedecinDto } from './dto/create-medecin.dto';
import { UpdateMedecinDto } from './dto/update-medecin.dto';

@Controller('medecin')
export class MedecinController {
  constructor(private readonly medecinService: MedecinService) {}

  // 🟢 Créer un médecin
  @Post()
  create(@Body() createMedecinDto: CreateMedecinDto) {
    return this.medecinService.create(createMedecinDto);
  }

  // 🟡 Récupérer tous les médecins
  @Get()
  findAll() {
    return this.medecinService.findAll();
  }

  // 🔵 Récupérer un médecin par ID
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.medecinService.findOne(+id);
  }

  // 🟠 Modifier un médecin
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateMedecinDto: UpdateMedecinDto,
  ) {
    return this.medecinService.update(+id, updateMedecinDto);
  }

  // 🔴 Supprimer un médecin
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.medecinService.remove(+id);
  }
}
