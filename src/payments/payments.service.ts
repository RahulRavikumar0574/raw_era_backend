import { Injectable, InternalServerErrorException } from '@nestjs/common';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly razorpay?: Razorpay;
  private readonly stripe?: any;

  constructor() {
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      this.razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID as string,
        key_secret: process.env.RAZORPAY_KEY_SECRET as string,
      });
    }
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Stripe = require('stripe');
        this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-09-30.acacia' });
      } catch (_) {
        this.stripe = undefined;
      }
    }
  }

  // Razorpay
  async createOrder(amountInPaise: number, currency = 'INR', receipt?: string) {
    if (!this.razorpay) throw new InternalServerErrorException('Razorpay not configured');
    try {
      const order = await this.razorpay.orders.create({ amount: amountInPaise, currency, receipt });
      return order;
    } catch (e: any) {
      throw new InternalServerErrorException(e?.message || 'Failed to create order');
    }
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
    if (!signature) return false;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    return expected === signature;
  }

  // Stripe
  async createStripePaymentIntent(amountInPaise: number, currency = 'inr', metadata?: Record<string, string>) {
    if (!this.stripe) throw new InternalServerErrorException('Stripe not configured');
    try {
      const intent = await this.stripe.paymentIntents.create({
        amount: amountInPaise,
        currency,
        metadata,
        automatic_payment_methods: { enabled: true },
      });
      return intent;
    } catch (e: any) {
      throw new InternalServerErrorException(e?.message || 'Failed to create payment intent');
    }
  }

  constructStripeEvent(rawBody: Buffer, signature: string | undefined) {
    if (!this.stripe) throw new InternalServerErrorException('Stripe not configured');
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;
    if (!endpointSecret) throw new InternalServerErrorException('Stripe webhook secret missing');
    if (!signature) throw new InternalServerErrorException('Stripe signature missing');
    return this.stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
  }
}
