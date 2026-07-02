import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ChatToolsService {
  private readonly logger = new Logger(ChatToolsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Product Search Tool
   * Search products by name, collection, category, description, or tags
   */
  async searchProducts(
  query: string,
  filters?: {
    categoryId?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
  },
) {
  console.log("\n================ searchProducts ================");
  console.log("Query:", query);
  console.log("Filters:", filters);

  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  console.log("Words:", words);

  const where: any = {
    isActive: true,
  };

  if (filters?.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (
    filters?.minPrice !== undefined ||
    filters?.maxPrice !== undefined
  ) {
    where.price = {};

    if (filters.minPrice !== undefined) {
      where.price.gte = filters.minPrice;
    }

    if (filters.maxPrice !== undefined) {
      where.price.lte = filters.maxPrice;
    }
  }

  if (filters?.inStock) {
    where.stock = { gt: 0 };
  }

  if (words.length > 0) {
    where.OR = words.flatMap((word) => [
      {
        name: {
          contains: word,
          mode: "insensitive" as const,
        },
      },
      {
        description: {
          contains: word,
          mode: "insensitive" as const,
        },
      },
      {
        brand: {
          contains: word,
          mode: "insensitive" as const,
        },
      },
      {
        shortDescription: {
          contains: word,
          mode: "insensitive" as const,
        },
      },
      {
        tags: {
          some: {
            name: {
              contains: word,
              mode: "insensitive" as const,
            },
          },
        },
      },
    ]);
  }

  console.log("Prisma where clause:");
  console.dir(where, { depth: null });

  const products = await this.prisma.product.findMany({
    where,
    include: {
      images: {
        where: { isPrimary: true },
        take: 1,
      },
      variants: true,
      specifications: true,
      category: true,
      tags: true,
    },
    take: 5,
    orderBy: [
      { isFeatured: "desc" },
      { rating: "desc" },
      { reviewCount: "desc" },
    ],
  });

  console.log("Products found:", products.length);

  products.forEach((p) => {
    console.log(`- ${p.name} (Stock: ${p.stock})`);
  });

  console.log("===============================================\n");

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.shortDescription || p.description,
    price: p.price,
    originalPrice: p.originalPrice,
    discount: p.discount,
    stock: p.stock,
    rating: p.rating,
    reviewCount: p.reviewCount,
    brand: p.brand,
    category: p.category.name,
    image: p.images[0]?.url,
    variants: this.groupVariants(p.variants),
    specifications: p.specifications.map((s) => ({
      name: s.name,
      value: s.value,
    })),
    tags: p.tags.map((t) => t.name),
  }));
}
  /**
   * Inventory Tool
   * Retrieve live inventory for a product
   */
  async getProductInventory(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId, isActive: true },
      include: {
        variants: true,
      },
    });

    if (!product) {
      return null;
    }

    const variantInventory = product.variants.reduce((acc, variant) => {
      if (!acc[variant.type]) {
        acc[variant.type] = {};
      }
      acc[variant.type][variant.value] = {
        stock: variant.stock,
        available: variant.stock > 0,
        price: variant.price || product.price,
        sku: variant.sku,
      };
      return acc;
    }, {} as Record<string, Record<string, any>>);

    return {
      productId: product.id,
      productName: product.name,
      totalStock: product.stock,
      variants: variantInventory,
      overallAvailable: product.stock > 0,
    };
  }

  /**
   * Pricing Tool
   * Return current price, sale price, and discounts
   */
  async getProductPricing(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId, isActive: true },
      select: {
        id: true,
        name: true,
        price: true,
        originalPrice: true,
        discount: true,
        variants: {
          select: {
            type: true,
            value: true,
            price: true,
          },
        },
      },
    });

    if (!product) {
      return null;
    }

    const variantPricing = product.variants.reduce((acc, variant) => {
      if (variant.price) {
        acc[`${variant.type}:${variant.value}`] = variant.price;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      productId: product.id,
      productName: product.name,
      basePrice: product.price,
      originalPrice: product.originalPrice,
      discount: product.discount,
      discountPercentage: product.originalPrice 
        ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
        : 0,
      onSale: product.discount !== null && product.discount > 0,
      variantPricing,
    };
  }

  /**
   * Coupon Tool
   * Retrieve active coupons from database
   */
  async getActiveCoupons() {
    const now = new Date();
    const coupons = await this.prisma.coupon.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        validUntil: { gte: now },
        OR: [
          { usageLimit: null },
          { usedCount: { lt: this.prisma.coupon.fields.usageLimit } },
        ],
      },
      select: {
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

    return coupons.map(c => ({
      code: c.code,
      name: c.name,
      description: c.description,
      type: c.type,
      value: c.value,
      minOrderAmount: c.minOrderAmount,
      maxDiscount: c.maxDiscount,
      validFrom: c.validFrom.toISOString(),
      validUntil: c.validUntil.toISOString(),
    }));
  }

  /**
   * Shipping Tool
   * Retrieve shipping configuration from settings
   */
  async getShippingInfo() {
    try {
      const shippingSettings = await this.prisma.setting.findUnique({
        where: { key: 'shipping_config' },
      });

      if (shippingSettings?.value) {
        return shippingSettings.value;
      }

      // Default shipping configuration
      return {
        freeShippingThreshold: 500,
        standardShipping: 50,
        expressShipping: 150,
        deliveryTimes: {
          standard: '5-7 business days',
          express: '2-3 business days',
        },
      };
    } catch (error) {
      this.logger.error('Error fetching shipping info', error);
      return null;
    }
  }

  /**
   * Order Tool
   * Retrieve order status for authenticated users or valid order IDs
   */
  async getOrderStatus(orderId: string, userId?: string) {
    const where: any = {
      orderNumber: orderId,
    };

    if (userId) {
      where.userId = userId;
    }

    const order = await this.prisma.order.findFirst({
      where,
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                images: { where: { isPrimary: true }, take: 1 },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return null;
    }

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: order.total,
      trackingNumber: order.trackingNumber,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: order.items.map(item => ({
        productName: item.product.name,
        quantity: item.quantity,
        price: item.price,
        image: item.product.images[0]?.url,
      })),
    };
  }

  /**
   * Recommendation Tool
   * Recommend products based on stock, rating, relevance
   */
  async getRecommendations(context: {
    productId?: string;
    category?: string;
    query?: string;
    limit?: number;
  }) {
    const limit = context.limit || 5;
    let where: any = {
      isActive: true,
      stock: { gt: 0 },
    };

    if (context.productId) {
      // Find similar products
      const product = await this.prisma.product.findUnique({
        where: { id: context.productId },
        select: { categoryId: true, price: true },
      });

      if (product) {
        where.id = { not: context.productId };
        where.categoryId = product.categoryId;
        where.price = { gte: product.price * 0.7, lte: product.price * 1.3 };
      }
    } else if (context.category) {
      where.category = {
        name: { contains: context.category, mode: 'insensitive' as const },
      };
    } else if (context.query) {
      const words = context.query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2);

      if (words.length > 0) {
        where.OR = words.flatMap((word) => [
          { name: { contains: word, mode: 'insensitive' as const } },
          { description: { contains: word, mode: 'insensitive' as const } },
          { tags: { some: { name: { contains: word, mode: 'insensitive' as const } } } },
        ]);
      }
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        category: true,
      },
      take: limit,
      orderBy: [
        { rating: 'desc' },
        { reviewCount: 'desc' },
        { stock: 'desc' },
      ],
    });

    return products.map(p => ({
      id: p.id,
      name: p.name,
      description: p.shortDescription || p.description.slice(0, 150),
      price: p.price,
      originalPrice: p.originalPrice,
      discount: p.discount,
      stock: p.stock,
      rating: p.rating,
      reviewCount: p.reviewCount,
      category: p.category.name,
      image: p.images[0]?.url,
    }));
  }

  /**
   * Helper: Group variants by type
   */
  private groupVariants(variants: any[]) {
    return variants.reduce((acc, variant) => {
      if (!acc[variant.type]) {
        acc[variant.type] = [];
      }
      acc[variant.type].push({
        value: variant.value,
        stock: variant.stock,
        price: variant.price,
        sku: variant.sku,
      });
      return acc;
    }, {} as Record<string, any[]>);
  }
}
