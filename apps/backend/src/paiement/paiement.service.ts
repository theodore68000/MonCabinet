import { Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';

@Injectable()
export class PaiementService {
  private readonly currency = 'eur';

  constructor(
    @Inject('STRIPE_CLIENT') private readonly stripe: Stripe,
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  private computeAmountForVisio(rdv: any): number {
    return 30 * 100;
  }

  private computePlatformFee(amountCents: number): number {
    return Math.round(amountCents * 0.1);
  }

  async createOrGetPaymentIntentForRdvVisio(
    rendezVousId: number,
    patientId: number,
  ) {
    const rdv = await this.prisma.rendezVous.findUnique({
      where: { id: rendezVousId },
      include: { medecin: true, paiement: true },
    });

    if (!rdv) throw new Error('Rendez-vous introuvable');
    if (rdv.typeConsultation !== 'VISIO')
      throw new Error('Ce rendez-vous ne nécessite pas de paiement');
    if (!rdv.medecinId || !rdv.medecin)
      throw new Error('Aucun médecin lié au RDV');

    // Paiement existant
    if (rdv.paiement) {
      if (rdv.paiement.status === 'SUCCES') {
        return { alreadyPaid: true, clientSecret: null };
      }

      const pi = await this.stripe.paymentIntents.retrieve(
        rdv.paiement.stripePaymentIntentId,
      );

      return {
        alreadyPaid: false,
        clientSecret: pi.client_secret,
      };
    }

    // Nouveau payment intent
    const medecin = rdv.medecin;
    const stripeAccountId =
      medecin.stripeAccountId ||
      (await this.stripeService.ensureMedecinStripeAccount(medecin.id));

    const amount = this.computeAmountForVisio(rdv);
    const platformFee = this.computePlatformFee(amount);

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount,
      currency: this.currency,
      automatic_payment_methods: { enabled: true },
      application_fee_amount: platformFee,
      transfer_data: { destination: stripeAccountId },
      metadata: {
        rendezVousId: String(rdv.id),
        medecinId: String(medecin.id),
        patientId: String(patientId),
      },
      expand: ['charges'], // IMPORTANT (Stripe 2025)
    });

    await this.prisma.paiement.create({
      data: {
        montantCents: amount,
        devise: this.currency,
        status: 'EN_COURS',
        stripePaymentIntentId: paymentIntent.id,
        platformFeeCents: platformFee,
        patientId,
        medecinId: medecin.id,
        rendezVousId: rdv.id,
      },
    });

    return {
      alreadyPaid: false,
      clientSecret: paymentIntent.client_secret,
    };
  }

  async markPaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const paiement = await this.prisma.paiement.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!paiement) return;

    // Stripe 2025 : charges n’existe plus dans le type → extension du type
    type PaymentIntentWithCharges = Stripe.PaymentIntent & {
      charges?: {
        data?: { id?: string }[];
      };
    };

    const pi = paymentIntent as PaymentIntentWithCharges;
    const chargeId = pi.charges?.data?.[0]?.id ?? null;

    await this.prisma.$transaction([
      this.prisma.paiement.update({
        where: { stripePaymentIntentId: paymentIntent.id },
        data: {
          status: 'SUCCES',
          stripeChargeId: chargeId,
        },
      }),
      this.prisma.rendezVous.update({
        where: { id: paiement.rendezVousId },
        data: { statutVisio: 'pret' },
      }),
    ]);
  }

  async markPaymentFailed(paymentIntent: Stripe.PaymentIntent, error?: string) {
    const paiement = await this.prisma.paiement.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!paiement) return;

    await this.prisma.$transaction([
      this.prisma.paiement.update({
        where: { stripePaymentIntentId: paymentIntent.id },
        data: {
          status: 'ECHEC',
        },
      }),
      this.prisma.rendezVous.update({
        where: { id: paiement.rendezVousId },
        data: { statutVisio: 'aucun' },
      }),
    ]);
  }

  async getPaymentStatusForRdv(rendezVousId: number, patientId: number) {
    const rdv = await this.prisma.rendezVous.findUnique({
      where: { id: rendezVousId },
      include: { paiement: true },
    });

    if (!rdv) throw new Error('Rendez-vous introuvable');

    if (!rdv.paiement) return { hasPayment: false, status: 'NONE' };

    if (rdv.paiement.patientId && rdv.paiement.patientId !== patientId)
      throw new Error('Ce paiement appartient à un autre patient');

    return {
      hasPayment: true,
      status: rdv.paiement.status,
    };
  }
}
