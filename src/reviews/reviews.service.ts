import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForProduct(productId: string) {
    return this.prisma.review.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
  }

  async upsert(userId: string, productId: string, data: { rating: number; title?: string; comment?: string }) {
    // Upsert by unique (userId, productId)
    const review = await this.prisma.review.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId, rating: data.rating, title: data.title, comment: data.comment, isVerified: false },
      update: { rating: data.rating, title: data.title, comment: data.comment },
    });
    // Update product aggregates
    await this.recomputeProductRating(productId);
    return review;
  }

  async remove(userId: string, productId: string) {
    const existing = await this.prisma.review.findUnique({ where: { userId_productId: { userId, productId } } });
    if (!existing) throw new NotFoundException('Review not found');
    if (existing.userId !== userId) throw new ForbiddenException();
    await this.prisma.review.delete({ where: { userId_productId: { userId, productId } } });
    await this.recomputeProductRating(productId);
    return { success: true };
  }

  private async recomputeProductRating(productId: string) {
    const agg = await this.prisma.review.aggregate({ where: { productId }, _avg: { rating: true }, _count: { _all: true } });
    await this.prisma.product.update({ where: { id: productId }, data: { rating: agg._avg.rating || 0, reviewCount: agg._count._all } });
  }
}
