import { Module } from '@nestjs/common';
import { CustomizationController } from './customization.controller';
import { CustomizationService } from './customization.service';
import { CloudinaryService } from './cloudinary.service';

@Module({
  controllers: [CustomizationController],
  providers: [CustomizationService, CloudinaryService],
  exports: [CustomizationService],
})
export class CustomizationModule {}
