import { Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StripeService {
  constructor(
    @Inject('STRIPE_CLIENT') private readonly stripe: Stripe,
    private readonly prisma: PrismaService,
  ) {}

  async ensureMedecinStripeAccount(medecinId: number) {
    const medecin = await this.prisma.medecin.findUnique({
      where: { id: medecinId },
    });
    if (!medecin) {
      throw new Error('Médecin introuvable');
    }

    if (medecin.stripeAccountId) {
      return medecin.stripeAccountId;
    }

    const account = await this.stripe.accounts.create({
      type: 'express',
      country: 'FR',
      email: medecin.email,
      business_type: 'individual',
      business_profile: {
        mcc: '8099', // services médicaux
        product_description: 'Consultations médicales en visio',
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    await this.prisma.medecin.update({
      where: { id: medecin.id },
      data: { stripeAccountId: account.id },
    });

    return account.id;
  }

  async createOnboardingLink(medecinId: number, baseFrontendUrl: string) {
    const accountId = await this.ensureMedecinStripeAccount(medecinId);

    const returnUrl = `${baseFrontendUrl}/medecin/dashboard/paiements?onboarding=success`;
    const refreshUrl = `${baseFrontendUrl}/medecin/dashboard/paiements?onboarding=refresh`;

    const link = await this.stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });

    return link.url;
  }

  async retrieveAccount(stripeAccountId: string) {
    return this.stripe.accounts.retrieve(stripeAccountId);
  }
}
