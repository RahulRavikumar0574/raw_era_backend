import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: { page?: number; pageSize?: number; q?: string; categorySlug?: string; isFeatured?: boolean; isNew?: boolean; sort?: 'price_asc' | 'price_desc' | 'newest' }) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(params.pageSize) || 12));

    const where: any = { isActive: true };
    if (params.q) where.OR = [{ name: { contains: params.q, mode: 'insensitive' } }, { description: { contains: params.q, mode: 'insensitive' } }];
    if (params.isFeatured !== undefined) where.isFeatured = params.isFeatured;
    if (params.isNew !== undefined) where.isNew = params.isNew;
    if (params.categorySlug) {
      const cat = await this.prisma.category.findUnique({ where: { slug: params.categorySlug } });
      if (cat) where.categoryId = cat.id; else where.categoryId = '___none___';
    }

    let orderBy: any = { createdAt: 'desc' };
    if (params.sort === 'price_asc') orderBy = { price: 'asc' };
    if (params.sort === 'price_desc') orderBy = { price: 'desc' };
    if (params.sort === 'newest') orderBy = { createdAt: 'desc' };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ 
        where, 
        orderBy, 
        skip: (page - 1) * pageSize, 
        take: pageSize, 
        include: { 
          images: true, 
          category: true, 
          variants: {
            where: {
              OR: [
                { type: 'SIZE' },
                { type: 'COLOR' }
              ]
            },
            orderBy: {
              name: 'asc'
            }
          } 
        } 
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async detail(id: string) {
    return this.prisma.product.findFirst({ 
      where: { id, isActive: true }, 
      include: { 
        images: true, 
        variants: {
          orderBy: {
            name: 'asc'
          }
        }, 
        specifications: true, 
        reviews: true, 
        category: true 
      } 
    });
  }
}
