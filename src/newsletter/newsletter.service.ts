import { Injectable, InternalServerErrorException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NewsletterService {
  private transporter: nodemailer.Transporter;

  constructor(private prisma: PrismaService) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async subscribe(email: string) {
    const existing = await this.prisma.subscriber.findUnique({
      where: { email },
    });

    if (existing) {
      if (!existing.isActive) {
        return this.prisma.subscriber.update({
          where: { email },
          data: { isActive: true },
        });
      }
      return { message: 'Already subscribed' };
    }

    return this.prisma.subscriber.create({
      data: { email },
    });
  }

  async broadcast(subject: string, htmlContent: string) {
    const subscribers = await this.prisma.subscriber.findMany({
      where: { isActive: true },
    });

    if (subscribers.length === 0) {
      return { message: 'No active subscribers found.' };
    }

    const emails = subscribers.map((sub) => sub.email);

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || '"Souled Store" <noreply@souledstore.com>',
        bcc: emails, // Use BCC so subscribers don't see each other's emails
        subject,
        html: htmlContent,
      });

      return { success: true, message: `Email broadcasted to ${emails.length} subscribers successfully.` };
    } catch (error) {
      throw new InternalServerErrorException('Failed to send broadcast email');
    }
  }
}
