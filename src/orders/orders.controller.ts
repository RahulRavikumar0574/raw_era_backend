import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    const userId = req.user.id;
    const order = await this.ordersService.createCodOrder(userId, body);
    return { order };
  }

  @Get()
  async list(@Req() req: any) {
    const userId = req.user.id;
    const orders = await this.ordersService.listUserOrders(userId);
    return { orders };
  }

  @Get(':id')
  async detail(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    const order = await this.ordersService.getOrder(userId, id);
    return { order };
  }
}
