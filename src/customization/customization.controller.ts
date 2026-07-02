import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CustomizationService } from './customization.service';
import { CloudinaryService } from './cloudinary.service';
import { CreateCustomizationRequestDto } from './dto/customization.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@Controller('customization')
export class CustomizationController {
  constructor(
    private readonly customizationService: CustomizationService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    const result = await this.cloudinaryService.uploadImage(file);
    return result;
  }

  @Post('request')
  async createRequest(@Body() body: CreateCustomizationRequestDto, @Req() req: any) {
    const customerId = req.user?.id;
    const request = await this.customizationService.createRequest(body, customerId);
    return { request };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async listAll() {
    const requests = await this.customizationService.listAll();
    return { requests };
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const request = await this.customizationService.getById(id);
    return { request };
  }
}
