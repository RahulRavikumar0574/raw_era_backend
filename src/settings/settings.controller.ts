import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('public')
  async getPublicSettings() {
    const settings = await this.settingsService.getPublicSettings();
    return { settings };
  }

  @UseGuards(AdminGuard)
  @Get(':key')
  async getSetting(@Param('key') key: string) {
    const setting = await this.settingsService.getSetting(key);
    return { setting };
  }

  @UseGuards(AdminGuard)
  @Put(':key')
  async updateSetting(@Param('key') key: string, @Body() body: { value: any }) {
    const setting = await this.settingsService.updateSetting(key, body.value);
    return { setting };
  }
}