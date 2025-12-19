import { Module } from '@nestjs/common';
import { MedecinService } from './medecin.service';
import { MedecinController } from './medecin.controller';
import { PrismaService } from '../prisma/prisma.service';
import { MailModule } from '../mail/mail.module';

import { MedecinStatsService } from './medecin-stats.service';
import { MedecinStatsController } from './medecin-stats.controller';
import { SecurityModule } from '../common/security/security.module';

@Module({
  imports: [MailModule, SecurityModule],
  controllers: [MedecinController, MedecinStatsController],
  providers: [MedecinService, PrismaService, MedecinStatsService],
})
export class MedecinModule {}
