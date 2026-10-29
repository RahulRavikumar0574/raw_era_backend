import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { SettingsService } from './settings.service';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly config: ConfigService,
  ) {}

  @Get('public')
  async getPublicSettings() {
    const settings = await this.settingsService.getPublicSettings();
    return { settings };
  }

  @Post('upload')
  @UseGuards(AdminGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async uploadBanner(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const cloudName = this.config.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get('CLOUDINARY_API_SECRET');

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
      return new Promise((resolve) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'raw-era/banners', resource_type: 'image' },
          (err, result) => {
            if (err || !result) {
              const b64 = file.buffer.toString('base64');
              resolve({ url: `data:${file.mimetype};base64,${b64}` });
            } else {
              resolve({ url: result.secure_url });
            }
          },
        );
        uploadStream.end(file.buffer);
      });
    }

    const b64 = file.buffer.toString('base64');
    return { url: `data:${file.mimetype};base64,${b64}` };
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
