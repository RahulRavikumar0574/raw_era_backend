import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatRateLimitGuard } from './rate-limit.guard';
import { ChatToolsService } from './tools/chat-tools.service';

@Module({
  controllers: [ChatController],
  providers: [ChatService, ChatRateLimitGuard, ChatToolsService],
  exports: [ChatService],
})
export class ChatModule {
  constructor() {
    console.log("[PROVIDER] ChatModule constructor executed");
  }
}
