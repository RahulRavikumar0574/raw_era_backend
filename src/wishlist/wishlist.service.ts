import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const items = await this.prisma.wishlistItem.findMany({ where: { userId }, include: { product: { include: { images: true } } } });
    return items;
  }

  async add(userId: string, productId: string) {
    const item = await this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    });
    return item;
  }

  async remove(userId: string, productId: string) {
    await this.prisma.wishlistItem.delete({ where: { userId_productId: { userId, productId } } });
    return { success: true };
  }
}
