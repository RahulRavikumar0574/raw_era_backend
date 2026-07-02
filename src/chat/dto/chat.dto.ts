import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  IsBase64,
} from 'class-validator';

export class ChatMessageDto {
  @IsIn(['user', 'assistant', 'system'])
  role!: 'user' | 'assistant' | 'system';

  @IsString()
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsBase64()
  imageData?: string;

  @IsOptional()
  @IsString()
  imageType?: string;
}

export class ChatRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];

  @IsOptional()
  @IsString()
  sessionId?: string;
}
