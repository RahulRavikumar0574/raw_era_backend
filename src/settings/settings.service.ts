import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicSettings() {
    const publicKeys = [
      'site.name',
      'site.description',
      'site.logo',
      'site.contact',
      'shipping.free_threshold',
      'shipping.base_rate',
    ];

    const settings = await this.prisma.setting.findMany({
      where: {
        key: { in: publicKeys },
      },
    });

    return settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});
  }

  async getSetting(key: string) {
    const setting = await this.prisma.setting.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundException(`Setting with key ${key} not found`);
    }

    return setting;
  }

  async updateSetting(key: string, value: any) {
    const existing = await this.prisma.setting.findUnique({
      where: { key },
    });

    if (existing) {
      return this.prisma.setting.update({
        where: { key },
        data: { value },
      });
    } else {
      return this.prisma.setting.create({
        data: { key, value },
      });
    }
  }
}