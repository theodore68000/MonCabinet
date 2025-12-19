import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { StripeService } from './stripe.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [ConfigModule],
  providers: [
    PrismaService,
    StripeService,
    {
      provide: 'STRIPE_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const apiKey = configService.get<string>('STRIPE_SECRET_KEY');
        if (!apiKey) {
          throw new Error('STRIPE_SECRET_KEY manquant dans .env');
        }

        return new Stripe(apiKey, {
          apiVersion: '2025-11-17.clover', // ← FIX
        });
      },
    },
  ],
  exports: ['STRIPE_CLIENT', StripeService],
})
export class StripeModule {}
