import { Module } from '@nestjs/common';
import { PatientService } from './patient.service';
import { PatientController } from './patient.controller';
import { PrismaService } from '../prisma/prisma.service';
import { MailModule } from '../mail/mail.module'; // ✅ Import nécessaire

@Module({
  imports: [MailModule], // ✅ Ajout
  controllers: [PatientController],
  providers: [PatientService, PrismaService],
})
export class PatientModule {}
