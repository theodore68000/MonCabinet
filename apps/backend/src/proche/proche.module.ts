import { Module } from '@nestjs/common';
import { ProcheService } from './proche.service';
import { ProcheController } from './proche.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [ProcheController],
  providers: [ProcheService, PrismaService],
  exports: [ProcheService]
})
export class ProcheModule {}
