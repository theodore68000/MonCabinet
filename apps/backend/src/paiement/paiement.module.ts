import { Module } from '@nestjs/common';
import { PaiementService } from './paiement.service';
import { PaiementController } from './paiement.controller';
import { PrismaService } from '../prisma/prisma.service';
import { StripeModule } from '../stripe/stripe.module';

@Module({
  imports: [StripeModule],
  providers: [PaiementService, PrismaService],
  controllers: [PaiementController],
  exports: [PaiementService],
})
export class PaiementModule {}
