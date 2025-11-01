import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CouponService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive() {
    const now = new Date();
    return this.prisma.coupon.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        type: true,
        value: true,
        minOrderAmount: true,
        maxDiscount: true,
        validFrom: true,
        validUntil: true,
      },
    });
  }

  async listAll() {
    return this.prisma.coupon.findMany({
      orderBy: { validUntil: 'desc' },
    });
  }

  async validate(code: string, amount: number) {
    const now = new Date();
    const coupon = await this.prisma.coupon.findFirst({
      where: {
        code: code.toUpperCase(),
        isActive: true,
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found or expired');
    }

    if (coupon.minOrderAmount && amount < coupon.minOrderAmount) {
      throw new BadRequestException(`Minimum order amount of ₹${coupon.minOrderAmount} required`);
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    let discount = 0;
    switch (coupon.type) {
      case 'PERCENTAGE':
        discount = (amount * coupon.value) / 100;
        if (coupon.maxDiscount && discount > coupon.maxDiscount) {
          discount = coupon.maxDiscount;
        }
        break;
      case 'FIXED_AMOUNT':
        discount = coupon.value;
        break;
      case 'FREE_SHIPPING':
        // This will be handled by the frontend/order processing
        discount = 0;
        break;
    }

    return {
      ...coupon,
      calculatedDiscount: discount,
    };
  }
}