import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('product/:productId')
  async listForProduct(@Param('productId') productId: string) {
    return this.reviews.listForProduct(productId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('product/:productId')
  async upsert(@Req() req: any, @Param('productId') productId: string, @Body() body: any) {
    return this.reviews.upsert(req.user.id, productId, { rating: Number(body.rating), title: body.title, comment: body.comment });
  }

  @UseGuards(JwtAuthGuard)
  @Delete('product/:productId')
  async remove(@Req() req: any, @Param('productId') productId: string) {
    return this.reviews.remove(req.user.id, productId);
  }
}
