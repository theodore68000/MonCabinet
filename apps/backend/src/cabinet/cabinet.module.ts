import { Module } from '@nestjs/common';
import { CabinetService } from './cabinet.service';
import { CabinetController } from './cabinet.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [CabinetController],
  providers: [CabinetService, PrismaService],
})
export class CabinetModule {}
