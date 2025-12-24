import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Prisma core
import { PrismaModule } from './prisma/prisma.module';

// Domaines métier
import { PatientModule } from './patient/patient.module';
import { RdvModule } from './rdv/rdv.module';
import { MedecinModule } from './medecin/medecin.module';
import { CabinetModule } from './cabinet/cabinet.module';
import { MessageModule } from './message/message.module';
import { ConversationModule } from './conversation/conversation.module';
import { VisioModule } from './visio/visio.module';
import { DocumentModule } from './document/document.module';
import { NotificationModule } from './notification/notification.module';
import { ProcheModule } from './proche/proche.module';
import { SecretaireModule } from './secretaire/secretaire.module';
import { ScheduleReferenceModule } from './schedule-reference/schedule-reference.module';

// Paiement + Stripe
import { StripeModule } from './stripe/stripe.module';
import { PaiementModule } from './paiement/paiement.module';
import { StripeWebhookController } from './stripe/stripe-webhook.controller';

// Audit Log
import { AuditModule } from './audit/audit.module';
import { AuditMiddleware } from './audit/audit.middleware';

// Health Check
import { HealthModule } from './health/health.module';

// ⏰ CRON
import { ScheduleModule } from '@nestjs/schedule';
import { CronModule } from './cron/cron.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // Core
    PrismaModule,
    AuditModule,
    HealthModule,

    // ⏰ Active les CRON
    ScheduleModule.forRoot(),

    // Module CRON
    CronModule,

    ScheduleReferenceModule,
    // Domaines
    PatientModule,
    RdvModule,
    MedecinModule,
    CabinetModule,
    MessageModule,
    ConversationModule,
    VisioModule,
    DocumentModule,
    ProcheModule,
    NotificationModule,
    SecretaireModule,

    // Paiement
    StripeModule,
    PaiementModule,
  ],
  controllers: [StripeWebhookController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuditMiddleware).forRoutes('*');
  }
}
