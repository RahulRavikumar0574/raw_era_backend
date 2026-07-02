import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatRateLimitGuard } from './rate-limit.guard';

@Module({
  controllers: [ChatController],
  providers: [ChatService, ChatRateLimitGuard],
  exports: [ChatService],
})
export class ChatModule {}
