import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const categories = [
    { name: "Men's", slug: 'mens', description: 'Mens apparel' },
    { name: "Women's", slug: 'womens', description: 'Womens apparel' },
    { name: 'Kids', slug: 'kids', description: 'Kids apparel' },
  ];

  for (const [index, c] of categories.entries()) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description, order: index },
      create: { name: c.name, slug: c.slug, description: c.description, order: index },
    });
  }

  const mens = await prisma.category.findUnique({ where: { slug: 'mens' } });
  const womens = await prisma.category.findUnique({ where: { slug: 'womens' } });
  const kids = await prisma.category.findUnique({ where: { slug: 'kids' } });

  if (!mens || !womens || !kids) throw new Error('Categories not found after creation');

  async function addProduct(p: {
    name: string;
    description: string;
    price: number;
    sku: string;
    brand: string;
    categoryId: string;
    images?: Array<{ url: string; alt?: string; isPrimary?: boolean; order?: number }>;
    variants?: Array<{ name: string; type: 'SIZE' | 'COLOR' | 'MATERIAL' | 'STYLE'; value: string; price?: number; stock?: number; sku?: string }>;
    tags?: string[];
    isFeatured?: boolean;
    isNew?: boolean;
    stock?: number;
  }) {
    const created = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        description: p.description,
        price: p.price,
        brand: p.brand,
        categoryId: p.categoryId,
        isFeatured: !!p.isFeatured,
        isNew: !!p.isNew,
        stock: p.stock ?? 100,
      },
      create: {
        name: p.name,
        description: p.description,
        price: p.price,
        brand: p.brand,
        categoryId: p.categoryId,
        sku: p.sku,
        isFeatured: !!p.isFeatured,
        isNew: !!p.isNew,
        stock: p.stock ?? 100,
      },
    });

    await prisma.productImage.deleteMany({ where: { productId: created.id } });
    if (p.images?.length) {
      for (const [i, img] of p.images.entries()) {
        await prisma.productImage.create({
          data: {
            productId: created.id,
            url: img.url,
            alt: img.alt || p.name,
            isPrimary: img.isPrimary || i === 0,
            order: img.order ?? i,
          },
        });
      }
    }

    await prisma.productVariant.deleteMany({ where: { productId: created.id } });
    if (p.variants?.length) {
      for (const v of p.variants) {
        await prisma.productVariant.create({
          data: {
            productId: created.id,
            name: v.name,
            type: v.type,
            value: v.value,
            price: v.price,
            stock: v.stock ?? 50,
            sku: v.sku,
          },
        });
      }
    }

    await prisma.productTag.deleteMany({ where: { productId: created.id } });
    if (p.tags?.length) {
      for (const t of p.tags) {
        await prisma.productTag.create({ data: { productId: created.id, name: t } });
      }
    }
  }

  await addProduct({
    name: 'Classic Oversized T-Shirt',
    description: 'Soft cotton oversized tee with premium print.',
    price: 899,
    sku: 'TEE-OVR-CLASSIC-BLK',
    brand: 'Raw Era',
    categoryId: mens.id,
    images: [
      { url: 'https://images.unsplash.com/photo-1520975916090-3105956dac38?q=80&w=1200', isPrimary: true },
    ],
    variants: [
      { name: 'Size', type: 'SIZE', value: 'S' },
      { name: 'Size', type: 'SIZE', value: 'M' },
      { name: 'Size', type: 'SIZE', value: 'L' },
      { name: 'Size', type: 'SIZE', value: 'XL' },
    ],
    tags: ['cotton', 'oversized', 'black'],
    isFeatured: true,
    isNew: true,
  });

  await addProduct({
    name: 'Vintage Graphic Hoodie',
    description: 'Cozy fleece hoodie with vintage graphic.',
    price: 1599,
    sku: 'HD-VTG-NVY',
    brand: 'Raw Era',
    categoryId: mens.id,
    images: [
      { url: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=1200', isPrimary: true },
    ],
    tags: ['hoodie', 'winter', 'navy'],
  });

  await addProduct({
    name: 'Summer Floral Dress',
    description: 'Lightweight floral dress perfect for summer outings.',
    price: 1299,
    sku: 'DRS-FLR-SUM',
    brand: 'Raw Era',
    categoryId: womens.id,
    images: [
      { url: 'https://images.unsplash.com/photo-1475180098004-ca77a66827be?q=80&w=1200', isPrimary: true },
    ],
    tags: ['dress', 'floral'],
    isFeatured: true,
  });

  await addProduct({
    name: 'Kids Cartoon Tee',
    description: 'Fun and colorful tee for kids with cartoon print.',
    price: 599,
    sku: 'KID-TEE-CRT',
    brand: 'Raw Era',
    categoryId: kids.id,
    images: [
      { url: 'https://images.unsplash.com/photo-1520975916090-3105956dac38?q=80&w=1200', isPrimary: true },
    ],
    tags: ['kids', 'cartoon'],
  });

  // More products
  await addProduct({
    name: 'Athleisure Joggers',
    description: 'Comfortable joggers for daily wear and workout.',
    price: 1099,
    sku: 'JG-Athl-GRY',
    brand: 'Raw Era',
    categoryId: mens.id,
    images: [ { url: 'https://images.unsplash.com/photo-1520975916090-3105956dac38?q=80&w=1200', isPrimary: true } ],
    tags: ['joggers', 'athleisure'],
  });
  await addProduct({
    name: 'Lightweight Windbreaker',
    description: 'Windbreaker jacket for breezy evenings.',
    price: 1799,
    sku: 'JK-WIND-LTBL',
    brand: 'Raw Era',
    categoryId: mens.id,
    images: [ { url: 'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?q=80&w=1200', isPrimary: true } ],
    tags: ['jacket', 'windbreaker'],
  });
  await addProduct({
    name: 'Everyday Tee - Women',
    description: 'Soft everyday tee with flattering fit.',
    price: 799,
    sku: 'TEE-W-EDY',
    brand: 'Raw Era',
    categoryId: womens.id,
    images: [ { url: 'https://images.unsplash.com/photo-1475180098004-ca77a66827be?q=80&w=1200', isPrimary: true } ],
    tags: ['tee', 'women'],
  });
  await addProduct({
    name: 'Kids Track Shorts',
    description: 'Breathable shorts for kids playtime.',
    price: 499,
    sku: 'KID-SHRT-TRK',
    brand: 'Raw Era',
    categoryId: kids.id,
    images: [ { url: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=1200', isPrimary: true } ],
    tags: ['kids', 'shorts'],
  });

  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
