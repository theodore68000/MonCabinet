import { Module } from '@nestjs/common';
import { RdvService } from './rdv.service';
import { RdvController } from './rdv.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RdvController],
  providers: [RdvService],
})
export class RdvModule {}
