import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { PatientModule } from './patient/patient.module';
import { RdvModule } from './rdv/rdv.module';
import { MedecinModule } from './medecin/medecin.module';
import { CabinetModule } from './cabinet/cabinet.module';
import { MailModule } from './mail/mail.module';
import { MessageModule } from './message/message.module';
import { ConversationModule } from './conversation/conversation.module'; // 💥 AJOUT ICI

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PatientModule,
    RdvModule,
    MedecinModule,
    CabinetModule,
    MailModule,
    MessageModule,
    ConversationModule, // 💥 AJOUT ICI AUSSI
  ],
})
export class AppModule {}
