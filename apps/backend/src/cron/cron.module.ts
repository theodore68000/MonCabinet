import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { PrismaService } from '../prisma/prisma.service';
import { FormulaireModule } from '../formulaire/formulaire.module';

@Module({
  imports: [FormulaireModule],
  providers: [CronService, PrismaService],
})
export class CronModule {}
