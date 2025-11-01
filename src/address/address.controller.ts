import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AddressService } from './address.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('addresses')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Get()
  async list(@Req() req: any) {
    const addresses = await this.addressService.list(req.user.id);
    return { addresses };
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    const address = await this.addressService.create(req.user.id, body);
    return { address };
  }

  @Put(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const address = await this.addressService.update(req.user.id, id, body);
    return { address };
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    await this.addressService.delete(req.user.id, id);
    return { success: true };
  }

  @Post(':id/default')
  async setDefault(@Req() req: any, @Param('id') id: string) {
    const address = await this.addressService.setDefault(req.user.id, id);
    return { address };
  }
}