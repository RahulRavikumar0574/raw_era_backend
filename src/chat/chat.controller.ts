import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto/chat.dto';
import { ChatRateLimitGuard } from './rate-limit.guard';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @UseGuards(ChatRateLimitGuard)
  async chat(@Body() body: ChatRequestDto) {
    const result = await this.chatService.chat(body.messages, body.sessionId);
    return result;
  }
}
