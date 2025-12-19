import {
  BadRequestException,
  Controller,
  Headers,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express'; // IMPORTANT
import Stripe from 'stripe';
import { PaiementService } from '../paiement/paiement.service';

@Controller('webhook/stripe')
export class StripeWebhookController {
  constructor(
    @Inject('STRIPE_CLIENT') private readonly stripe: Stripe,
    private readonly paiementService: PaiementService,
  ) {}

  @Post()
  async handle(@Req() req: Request, @Headers('stripe-signature') sig: string) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET manquant dans l'environnement");
    }

    let event: Stripe.Event;

    try {
      const rawBody = req.body as Buffer;
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        sig,
        webhookSecret,
      );
    } catch (err: any) {
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await this.paiementService.markPaymentSucceeded(pi);
        break;
      }

      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const lastError = (pi as any)?.last_payment_error?.message;
        await this.paiementService.markPaymentFailed(pi, lastError);
        break;
      }

      default:
        break;
    }

    return { received: true };
  }
}
