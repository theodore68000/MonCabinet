import { Module } from '@nestjs/common';
import { MedecinService } from './medecin.service';
import { MedecinController } from './medecin.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [MedecinController],
  providers: [MedecinService, PrismaService],
})
export class MedecinModule {}
