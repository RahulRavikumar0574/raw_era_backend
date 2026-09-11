import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './create-product.dto';

const PRODUCT_INCLUDE = {
  images: { orderBy: { order: 'asc' as const } },
  category: true,
  variants: { orderBy: { name: 'asc' as const } },
  specifications: true,
  tags: true,
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    page?: number;
    pageSize?: number;
    q?: string;
    categorySlug?: string;
    isFeatured?: boolean;
    isNew?: boolean;
    sort?: 'price_asc' | 'price_desc' | 'newest';
    includeInactive?: boolean;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(params.pageSize) || 12));

    const where: any = params.includeInactive ? {} : { isActive: true };
    if (params.q)
      where.OR = [
        { name: { contains: params.q, mode: 'insensitive' } },
        { description: { contains: params.q, mode: 'insensitive' } },
      ];
    if (params.isFeatured !== undefined) where.isFeatured = params.isFeatured;
    if (params.isNew !== undefined) where.isNew = params.isNew;
    if (params.categorySlug) {
      const cat = await this.prisma.category.findUnique({ where: { slug: params.categorySlug } });
      if (cat) where.categoryId = cat.id;
      else where.categoryId = '___none___';
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
          images: { orderBy: { order: 'asc' } },
          category: true,
          variants: {
            where: { OR: [{ type: 'SIZE' }, { type: 'COLOR' }] },
            orderBy: { name: 'asc' },
          },
          tags: true,
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    // Normalise tags to simple string array for frontend compatibility
    const normalised = items.map((p: any) => ({
      ...p,
      tags: (p.tags || []).map((t: any) => t.name),
    }));

    return { items: normalised, total, page, pageSize };
  }

  async detail(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, isActive: true },
      include: {
        images: { orderBy: { order: 'asc' } },
        variants: { orderBy: { name: 'asc' } },
        specifications: true,
        tags: true,
        reviews: true,
        category: true,
      },
    });

    if (!product) return null;

    return {
      ...product,
      tags: ((product as any).tags || []).map((t: any) => t.name),
    };
  }

  async create(dto: CreateProductDto) {
    const sku = dto.sku?.trim() || `SKU-${Date.now()}`;

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description || '',
        shortDescription: dto.shortDescription,
        price: dto.price,
        originalPrice: dto.originalPrice,
        discount: dto.discount,
        sku,
        brand: dto.brand || 'Unknown',
        categoryId: dto.categoryId,
        stock: dto.stock ?? 0,
        isActive: dto.isActive ?? true,
        isFeatured: dto.isFeatured ?? false,
        isNew: dto.isNew ?? true,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        images: dto.images?.length
          ? {
              create: dto.images.map((img, i) => ({
                url: img.url,
                alt: img.alt || dto.name,
                isPrimary: img.isPrimary ?? i === 0,
                order: img.order ?? i + 1,
              })),
            }
          : undefined,
        variants: dto.variants?.length
          ? {
              create: dto.variants.map((v) => ({
                name: v.name,
                type: v.type,
                value: v.value,
                price: v.price,
                stock: v.stock ?? 0,
                sku: v.sku,
              })),
            }
          : undefined,
        specifications: dto.specifications?.length
          ? {
              create: dto.specifications.map((s) => ({
                name: s.name,
                value: s.value,
                group: s.group,
              })),
            }
          : undefined,
        tags: dto.tags?.length
          ? { create: dto.tags.map((t) => ({ name: t })) }
          : undefined,
      },
      include: {
        images: true,
        category: true,
        variants: true,
        specifications: true,
        tags: true,
      },
    });

    return {
      ...product,
      tags: ((product as any).tags || []).map((t: any) => t.name),
    };
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Product ${id} not found`);

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.shortDescription !== undefined && { shortDescription: dto.shortDescription }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.originalPrice !== undefined && { originalPrice: dto.originalPrice }),
        ...(dto.discount !== undefined && { discount: dto.discount }),
        ...(dto.sku !== undefined && { sku: dto.sku }),
        ...(dto.brand !== undefined && { brand: dto.brand }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.stock !== undefined && { stock: dto.stock }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
        ...(dto.isNew !== undefined && { isNew: dto.isNew }),
        ...(dto.seoTitle !== undefined && { seoTitle: dto.seoTitle }),
        ...(dto.seoDescription !== undefined && { seoDescription: dto.seoDescription }),
      },
      include: {
        images: true,
        category: true,
        variants: true,
        specifications: true,
        tags: true,
      },
    });

    return {
      ...product,
      tags: ((product as any).tags || []).map((t: any) => t.name),
    };
  }

  async toggleStatus(id: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Product ${id} not found`);

    const updated = await this.prisma.product.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
    return updated;
  }

  async remove(id: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Product ${id} not found`);

    await this.prisma.product.delete({ where: { id } });
    return { success: true, id };
  }
}
