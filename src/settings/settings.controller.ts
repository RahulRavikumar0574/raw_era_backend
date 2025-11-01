import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('public')
  async getPublicSettings() {
    const settings = await this.settingsService.getPublicSettings();
    return { settings };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':key')
  async getSetting(@Param('key') key: string) {
    const setting = await this.settingsService.getSetting(key);
    return { setting };
  }

  @UseGuards(JwtAuthGuard)
  @Put(':key')
  async updateSetting(@Param('key') key: string, @Body() body: { value: any }) {
    const setting = await this.settingsService.updateSetting(key, body.value);
    return { setting };
  }
}