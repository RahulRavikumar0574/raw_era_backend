import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('create-order')
  async createOrder(@Body() body: any) {
    const amountInPaise = Number(body.amountInPaise);
    const currency = body.currency || 'INR';
    const receipt = body.receipt;
    const order = await this.paymentsService.createOrder(amountInPaise, currency, receipt);
    return { order };
  }

  // Razorpay webhooks send raw body; we handle raw body in main.ts
  @HttpCode(HttpStatus.OK)
  @Post('webhook')
  async webhook(@Req() req: any, @Headers('x-razorpay-signature') signature?: string) {
    const secret = process.env.RAZORPAY_KEY_SECRET as string;
    const rawBody = req.rawBody as Buffer;
    const ok = this.paymentsService.verifyWebhookSignature(rawBody, signature, secret);
    if (!ok) {
      return { received: true, verified: false };
    }
    // TODO: handle event types (payment.captured, order.paid, etc.)
    return { received: true, verified: true };
  }

  // Stripe: create payment intent
  @UseGuards(JwtAuthGuard)
  @Post('stripe/create-intent')
  async createStripeIntent(@Body() body: any) {
    const amountInPaise = Number(body.amountInPaise);
    const currency = (body.currency || 'inr').toLowerCase();
    const metadata = body.metadata || undefined;
    const intent = await this.paymentsService.createStripePaymentIntent(amountInPaise, currency, metadata);
    return { clientSecret: intent.client_secret };
  }

  // Stripe webhook
  @HttpCode(HttpStatus.OK)
  @Post('stripe/webhook')
  async stripeWebhook(@Req() req: any, @Headers('stripe-signature') signature?: string) {
    const rawBody = req.rawBody as Buffer;
    const event = this.paymentsService.constructStripeEvent(rawBody, signature);
    // TODO: handle payment_intent.succeeded, payment_intent.payment_failed, etc.
    return { received: true, type: event.type };
  }
}
