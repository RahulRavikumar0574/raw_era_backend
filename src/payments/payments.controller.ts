import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import * as crypto from 'crypto';

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
    return { order, keyId: process.env.RAZORPAY_KEY_ID };
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify')
  async verifyPayment(@Body() body: any) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = body;
    
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
      throw new BadRequestException('Missing payment verification details');
    }

    const secret = process.env.RAZORPAY_KEY_SECRET as string;
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const expectedSignature = shasum.digest('hex');

    if (expectedSignature !== razorpay_signature) {
      throw new BadRequestException('Payment verification signature mismatch');
    }

    // Update order status in DB
    const updatedOrder = await this.paymentsService.prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'COMPLETED',
        status: 'CONFIRMED',
        notes: `Paid via Razorpay. Payment ID: ${razorpay_payment_id}. Order ID: ${razorpay_order_id}`,
      },
    });

    return { success: true, order: updatedOrder };
  }

  // Razorpay webhooks send raw body; we handle raw body in main.ts
  @HttpCode(HttpStatus.OK)
  @Post('webhook')
  async webhook(@Req() req: any, @Headers('x-razorpay-signature') signature?: string) {
    const secret = (process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET) as string;
    const rawBody = req.rawBody as Buffer;
    const ok = this.paymentsService.verifyWebhookSignature(rawBody, signature, secret);
    if (!ok) {
      return { received: true, verified: false };
    }
    
    try {
      const event = JSON.parse(rawBody.toString());
      if (event.event === 'order.paid' || event.event === 'payment.captured') {
        const razorpayOrderId = event.payload?.payment?.entity?.order_id || event.payload?.order?.entity?.id;
        const razorpayPaymentId = event.payload?.payment?.entity?.id;
        const receipt = event.payload?.order?.entity?.receipt || event.payload?.payment?.entity?.description;

        if (receipt) {
          const order = await this.paymentsService.prisma.order.findFirst({
            where: {
              OR: [
                { orderNumber: receipt },
                { id: receipt },
              ],
            },
          });

          if (order && order.paymentStatus === 'PENDING') {
            await this.paymentsService.prisma.order.update({
              where: { id: order.id },
              data: {
                paymentStatus: 'COMPLETED',
                status: 'CONFIRMED',
                notes: `Paid via Razorpay Webhook. Payment ID: ${razorpayPaymentId}. Order ID: ${razorpayOrderId}`,
              },
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to process Razorpay webhook:', err);
    }

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
