import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
  findOne(@Param('id') id: string) {
    return this.cabinetService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCabinetDto: UpdateCabinetDto,
  ) {
    return this.cabinetService.update(+id, updateCabinetDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cabinetService.remove(+id);
  }
}
