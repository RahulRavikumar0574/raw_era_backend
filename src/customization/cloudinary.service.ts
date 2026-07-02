import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

@Injectable()
export class CloudinaryService {
  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.config.get('CLOUDINARY_API_KEY'),
      api_secret: this.config.get('CLOUDINARY_API_SECRET'),
    });
  }

  validateFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Allowed: PNG, JPG, JPEG, WEBP');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }
  }

  async uploadImage(file: Express.Multer.File) {
    this.validateFile(file);

    const cloudName = this.config.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new BadRequestException(
        'Image upload is not configured. Please set Cloudinary credentials.',
      );
    }

    return new Promise<{ imageUrl: string; publicId: string; fileName: string }>(
      (resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'raw-era/customizations',
            resource_type: 'image',
            allowed_formats: ['png', 'jpg', 'jpeg', 'webp'],
          },
          (error, result) => {
            if (error || !result) {
              reject(new BadRequestException('Failed to upload image'));
              return;
            }
            resolve({
              imageUrl: result.secure_url,
              publicId: result.public_id,
              fileName: file.originalname,
            });
          },
        );
        uploadStream.end(file.buffer);
      },
    );
  }
}
