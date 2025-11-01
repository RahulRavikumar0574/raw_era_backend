import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AddressService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, data: any) {
    // If this is the first address, make it default
    const addressCount = await this.prisma.address.count({ where: { userId } });
    const isDefault = addressCount === 0 ? true : !!data.isDefault;

    // If setting as default, unset any existing default
    if (isDefault) {
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.create({
      data: {
        userId,
        type: data.type,
        firstName: data.firstName,
        lastName: data.lastName,
        company: data.company,
        address1: data.address1,
        address2: data.address2,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country || 'India',
        phone: data.phone,
        isDefault,
      },
    });
  }

  async update(userId: string, id: string, data: any) {
    // Check if address exists and belongs to user
    const address = await this.prisma.address.findFirst({
      where: { id, userId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    // If setting as default, unset any existing default
    if (data.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.update({
      where: { id },
      data: {
        type: data.type,
        firstName: data.firstName,
        lastName: data.lastName,
        company: data.company,
        address1: data.address1,
        address2: data.address2,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country || 'India',
        phone: data.phone,
        isDefault: !!data.isDefault,
      },
    });
  }

  async delete(userId: string, id: string) {
    // Check if address exists and belongs to user
    const address = await this.prisma.address.findFirst({
      where: { id, userId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    await this.prisma.address.delete({ where: { id } });

    // If deleted address was default, set another as default if available
    if (address.isDefault) {
      const anotherAddress = await this.prisma.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (anotherAddress) {
        await this.prisma.address.update({
          where: { id: anotherAddress.id },
          data: { isDefault: true },
        });
      }
    }

    return true;
  }

  async setDefault(userId: string, id: string) {
    // Check if address exists and belongs to user
    const address = await this.prisma.address.findFirst({
      where: { id, userId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    // Unset any existing default
    await this.prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    // Set new default
    return this.prisma.address.update({
      where: { id },
      data: { isDefault: true },
    });
  }
}