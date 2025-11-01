import { Controller, Get, Param } from '@nestjs/common';
import { CategoriesService } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  async list() {
    return this.categories.list();
  }

  @Get(':slug')
  async bySlug(@Param('slug') slug: string) {
    return this.categories.bySlug(slug);
  }
}
