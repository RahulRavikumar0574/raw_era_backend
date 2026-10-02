import { Controller, Post, Body } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';

@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('subscribe')
  async subscribe(@Body('email') email: string) {
    if (!email || !email.includes('@')) {
      return { error: 'Valid email is required' };
    }
    await this.newsletterService.subscribe(email);
    return { success: true, message: 'Subscribed successfully' };
  }

  @Post('broadcast')
  async broadcast(@Body() body: { subject: string; htmlContent: string }) {
    if (!body.subject || !body.htmlContent) {
      return { error: 'Subject and htmlContent are required' };
    }
    return this.newsletterService.broadcast(body.subject, body.htmlContent);
  }
}
