import { Module } from '@nestjs/common';
import { RdvService } from './rdv.service';
import { RdvController } from './rdv.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NotificationModule } from 'src/notification/notification.module';
import { FormulaireModule } from 'src/formulaire/formulaire.module';

@Module({
  imports: [
    PrismaModule,
    NotificationModule,
    FormulaireModule,
  ],
  controllers: [RdvController],
  providers: [RdvService],
  exports: [
    RdvService, // ✅ OBLIGATOIRE
  ],
})
export class RdvModule {}
