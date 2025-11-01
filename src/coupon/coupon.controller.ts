import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CouponService } from './coupon.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@Controller('coupons')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @Get()
  async list() {
    const coupons = await this.couponService.listActive();
    return { coupons };
  }

  @Post('validate')
  async validate(@Body() body: { code: string; amount: number }) {
    const coupon = await this.couponService.validate(body.code, body.amount);
    return { coupon };
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin')
  async adminList() {
    const coupons = await this.couponService.listAll();
    return { coupons };
  }
}