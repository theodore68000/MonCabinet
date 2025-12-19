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
} from '@nestjs/common';
import { CabinetService } from './cabinet.service';
import { CreateCabinetDto } from './dto/create-cabinet.dto';
import { UpdateCabinetDto } from './dto/update-cabinet.dto';

@Controller('cabinet')
export class CabinetController {
  constructor(private readonly cabinetService: CabinetService) {}

  @Post()
  create(@Body() createCabinetDto: CreateCabinetDto) {
    return this.cabinetService.create(createCabinetDto);
  }

  @Get()
  findAll() {
    return this.cabinetService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const cab = await this.cabinetService.findOne(id);

    if (!cab) throw new NotFoundException('Cabinet introuvable');

    return {
      id: cab.id,
      nom: cab.nom,
      adresse: cab.adresse,
      createdAt: cab.createdAt,
      updatedAt: cab.updatedAt,

      // 🔥 NE RENVOIE PAS les infos sensibles, uniquement ce qu’il faut pour la messagerie
      medecins: cab.medecins.map(m => ({
        id: m.id,
        nom: m.nom,
        prenom: m.prenom,
        email: m.email,
        photoUrl: m.photoUrl,
      })),
    };
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCabinetDto: UpdateCabinetDto,
  ) {
    return this.cabinetService.update(id, updateCabinetDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.cabinetService.remove(id);
  }
}
