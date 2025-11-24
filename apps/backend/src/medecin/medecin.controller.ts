// src/medecin/medecin.controller.ts

import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { MedecinService } from './medecin.service';
import { CreateMedecinDto } from './dto/create-medecin.dto';
import { UpdateMedecinDto } from './dto/update-medecin.dto';

@Controller('medecin')
export class MedecinController {
  constructor(private readonly medecinService: MedecinService) {}

  @Post()
  create(@Body() data: CreateMedecinDto) {
    return this.medecinService.create(data);
  }

  @Post('login')
  login(@Body() body: { email: string; motDePasse: string }) {
    return this.medecinService.login(body.email, body.motDePasse);
  }

  @Post('forgot-password')
  forgotPassword(@Body('email') email: string) {
    return this.medecinService.forgotPassword(email);
  }

  @Post('reset-password/:token')
  resetPassword(
    @Param('token') token: string,
    @Body('motDePasse') motDePasse: string,
  ) {
    return this.medecinService.resetPassword(token, motDePasse);
  }

  @Get()
  findAll() {
    return this.medecinService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.medecinService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateMedecinDto) {
    return this.medecinService.update(+id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.medecinService.remove(+id);
  }
}
