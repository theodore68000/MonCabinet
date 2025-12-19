import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ProcheService } from './proche.service';
import { CreateProcheDto } from './dto/create-proche.dto';
import { UpdateProcheDto } from './dto/update-proche.dto';

@Controller('proches')
export class ProcheController {
  constructor(private readonly procheService: ProcheService) {}

  @Post()
  create(@Body() dto: CreateProcheDto) {
    return this.procheService.create(dto);
  }

  @Get('patient/:patientId')
  findByPatient(@Param('patientId') patientId: string) {
    return this.procheService.findByPatient(Number(patientId));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.procheService.findOne(Number(id));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProcheDto) {
    return this.procheService.update(Number(id), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.procheService.remove(Number(id));
  }
}
