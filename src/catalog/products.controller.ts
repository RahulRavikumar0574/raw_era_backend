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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { CreateProductDto, UpdateProductDto } from './create-product.dto';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly config: ConfigService,
  ) {}

  @Post('upload')
  @UseGuards(AdminGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { error: 'No file uploaded' };
    }

    const cloudName = this.config.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get('CLOUDINARY_API_SECRET');

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'raw-era/products', resource_type: 'image' },
          (err, result) => {
            if (err || !result) {
              const b64 = file.buffer.toString('base64');
              resolve({ url: `data:${file.mimetype};base64,${b64}` });
            } else {
              resolve({ url: result.secure_url });
            }
          },
        );
        uploadStream.end(file.buffer);
      });
    }

    const b64 = file.buffer.toString('base64');
    return { url: `data:${file.mimetype};base64,${b64}` };
  }

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
