import { Module } from '@nestjs/common';
import { VisioService } from './visio.service';
import { VisioController } from './visio.controller';
import { PrismaService } from 'src/prisma/prisma.service';

// 🔥 Ajout indispensable pour accéder à PaiementService
import { PaiementModule } from '../paiement/paiement.module';

@Module({
  imports: [
    PaiementModule, // ← FIX : rend PaiementService disponible dans VisioModule
  ],
  controllers: [VisioController],
  providers: [VisioService, PrismaService],
})
export class VisioModule {}
