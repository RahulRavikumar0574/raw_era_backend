import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string) {
    const items = await this.prisma.cartItem.findMany({ where: { userId }, include: { product: { include: { images: true } } } });
    return items;
  }

  async addItem(userId: string, data: { productId: string; quantity?: number; variantId?: string }) {
    const { productId, quantity = 1, variantId } = data;
    
    // For products without variants, we need to handle the unique constraint differently
    if (!variantId) {
      // Check if item already exists without variant
      const existing = await this.prisma.cartItem.findFirst({
        where: { userId, productId, variantId: null }
      });
      
      if (existing) {
        // Update existing item
        const item = await this.prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: { increment: quantity } }
        });
        return item;
      } else {
        // Create new item
        const item = await this.prisma.cartItem.create({
          data: { userId, productId, quantity, variantId: null }
        });
        return item;
      }
    } else {
      // Handle items with variants using the composite unique constraint
      const item = await this.prisma.cartItem.upsert({
        where: {
          userId_productId_variantId: {
            userId,
            productId,
            variantId,
          },
        },
        create: { userId, productId, quantity, variantId },
        update: { quantity: { increment: quantity } },
      });
      return item;
    }
  }

  async updateItem(userId: string, data: { productId: string; quantity: number; variantId?: string }) {
    const { productId, quantity, variantId } = data;
    if (quantity <= 0) return this.removeItem(userId, { productId, variantId });
    
    if (!variantId) {
      const existing = await this.prisma.cartItem.findFirst({
        where: { userId, productId, variantId: null }
      });
      if (existing) {
        const item = await this.prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity }
        });
        return item;
      }
    } else {
      const item = await this.prisma.cartItem.update({
        where: {
          userId_productId_variantId: {
            userId,
            productId,
            variantId,
          },
        },
        data: { quantity },
      });
      return item;
    }
  }

  async removeItem(userId: string, data: { productId: string; variantId?: string }) {
    const { productId, variantId } = data;
    
    if (!variantId) {
      const existing = await this.prisma.cartItem.findFirst({
        where: { userId, productId, variantId: null }
      });
      if (existing) {
        await this.prisma.cartItem.delete({
          where: { id: existing.id }
        });
      }
    } else {
      await this.prisma.cartItem.delete({
        where: {
          userId_productId_variantId: {
            userId,
            productId,
            variantId,
          },
        },
      });
    }
    return { success: true };
  }

  async clear(userId: string) {
    await this.prisma.cartItem.deleteMany({ where: { userId } });
    return { success: true };
  }
}
