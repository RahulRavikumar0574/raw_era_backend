import { Body, Controller, Delete, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  async get(@Req() req: any) {
    const items = await this.cart.getCart(req.user.id);
    return { items };
  }

  @Post()
  async add(@Req() req: any, @Body() body: any) {
    const item = await this.cart.addItem(req.user.id, body);
    return { item };
  }

  @Put()
  async update(@Req() req: any, @Body() body: any) {
    const item = await this.cart.updateItem(req.user.id, body);
    return { item };
  }

  @Delete()
  async remove(@Req() req: any, @Body() body: any) {
    return this.cart.removeItem(req.user.id, body);
  }

  @Delete('clear')
  async clear(@Req() req: any) {
    return this.cart.clear(req.user.id);
  }
}
