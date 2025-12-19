import { Module } from '@nestjs/common';
import { PatientController } from './patient.controller';
import { PatientService } from './patient.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RdvModule } from 'src/rdv/rdv.module';
import { MailModule } from 'src/mail/mail.module';
import { SecurityModule } from 'src/common/security/security.module'; // ✅

@Module({
  imports: [
    PrismaModule,
    RdvModule,
    MailModule,
    SecurityModule, // ✅ C’EST TOUT
  ],
  controllers: [PatientController],
  providers: [PatientService],
})
export class PatientModule {}
