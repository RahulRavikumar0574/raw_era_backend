import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') q?: string,
    @Query('category') categorySlug?: string,
    @Query('isFeatured') isFeatured?: string,
    @Query('isNew') isNew?: string,
    @Query('sort') sort?: 'price_asc' | 'price_desc' | 'newest',
  ) {
    const result = await this.products.list({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      q,
      categorySlug,
      isFeatured: isFeatured !== undefined ? isFeatured === 'true' : undefined,
      isNew: isNew !== undefined ? isNew === 'true' : undefined,
      sort,
    });
    return result;
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.products.detail(id);
  }
}
