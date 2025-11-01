import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createCodOrder(userId: string, payload: { items: Array<{ productId: string; quantity: number; price: number; variantId?: string }>; shippingAddress: any; notes?: string; totals: { subtotal: number; tax: number; shipping: number; discount: number; total: number } }) {
    const orderNumber = `ORD-${Date.now()}`;
    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        userId,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        paymentMethod: 'COD',
        subtotal: payload.totals.subtotal,
        tax: payload.totals.tax,
        shipping: payload.totals.shipping,
        discount: payload.totals.discount,
        total: payload.totals.total,
        shippingAddress: payload.shippingAddress,
        notes: payload.notes,
        items: {
          create: payload.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            price: i.price,
            variantId: i.variantId,
          })),
        },
      },
      include: { items: true },
    });
    return order;
  }

  async listUserOrders(userId: string) {
    return this.prisma.order.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async getOrder(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({ where: { id, userId }, include: { items: true } });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}
