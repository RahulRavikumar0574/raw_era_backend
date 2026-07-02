import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UploadedImageDto {
  @IsString()
  imageUrl!: string;

  @IsString()
  publicId!: string;

  @IsString()
  fileName!: string;
}

export class CreateCustomizationRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  customerName!: string;

  @IsEmail()
  customerEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  customerPhone?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  @MinLength(20, { message: 'Description must be at least 20 characters' })
  @MaxLength(1000, { message: 'Description must not exceed 1000 characters' })
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  additionalNotes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UploadedImageDto)
  images?: UploadedImageDto[];
}
