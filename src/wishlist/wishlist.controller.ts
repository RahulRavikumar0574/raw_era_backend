import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  async list(@Req() req: any) {
    const items = await this.wishlist.list(req.user.id);
    return { items };
  }

  @Post(':productId')
  async add(@Req() req: any, @Param('productId') productId: string) {
    const item = await this.wishlist.add(req.user.id, productId);
    return { item };
  }

  @Delete(':productId')
  async remove(@Req() req: any, @Param('productId') productId: string) {
    return this.wishlist.remove(req.user.id, productId);
  }
}
