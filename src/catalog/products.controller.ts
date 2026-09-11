import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { CreateProductDto, UpdateProductDto } from './create-product.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  // ── Public routes ─────────────────────────────────────────────────────────

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
    return this.products.list({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      q,
      categorySlug,
      isFeatured: isFeatured !== undefined ? isFeatured === 'true' : undefined,
      isNew: isNew !== undefined ? isNew === 'true' : undefined,
      sort,
    });
  }

  // ── Admin routes (protected) — MUST come before @Get(':id') ──────────────

  /** Admin-only: list ALL products including inactive ones */
  @Get('admin/all')
  @UseGuards(AdminGuard)
  async adminList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') q?: string,
    @Query('category') categorySlug?: string,
    @Query('sort') sort?: 'price_asc' | 'price_desc' | 'newest',
  ) {
    return this.products.list({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      q,
      categorySlug,
      sort,
      includeInactive: true,
    });
  }

  @Post()
  @UseGuards(AdminGuard)
  async create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  // ── Routes with :id param — MUST come after static routes ─────────────────

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.products.detail(id);
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Patch(':id/status')
  @UseGuards(AdminGuard)
  async toggleStatus(@Param('id') id: string) {
    return this.products.toggleStatus(id);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.products.remove(id);
  }
}
