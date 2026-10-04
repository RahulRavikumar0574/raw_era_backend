import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    let categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: {
        children: {
          where: { isActive: true },
          orderBy: [{ order: 'asc' }, { name: 'asc' }],
        },
      },
    });

    if (categories.length === 0) {
      const defaults = [
        { name: "Men's Clothing", slug: 'mens', order: 0 },
        { name: "Women's Clothing", slug: 'womens', order: 1 },
        { name: 'Unisex Clothing', slug: 'unisex', order: 2 },
        { name: 'Kids Clothing', slug: 'kids', order: 3 },
        { name: 'Accessories', slug: 'accessories', order: 4 },
      ];
      for (const d of defaults) {
        await this.prisma.category.upsert({
          where: { slug: d.slug },
          update: { name: d.name },
          create: { name: d.name, slug: d.slug, order: d.order },
        });
      }
      categories = await this.prisma.category.findMany({
        where: { isActive: true },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        include: {
          children: {
            where: { isActive: true },
            orderBy: [{ order: 'asc' }, { name: 'asc' }],
          },
        },
      });
    }

    // Filter to only return top-level categories
    return { categories: categories.filter(c => !c.parentId) };
  }

  async bySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug, isActive: true },
      include: {
        children: {
          where: { isActive: true },
          orderBy: [{ order: 'asc' }, { name: 'asc' }],
        },
        parent: true,
      },
    });
    
    return { category };
  }
}
