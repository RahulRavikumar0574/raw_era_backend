import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: {
        children: {
          where: { isActive: true },
          orderBy: [{ order: 'asc' }, { name: 'asc' }],
        },
      },
    });
    
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
