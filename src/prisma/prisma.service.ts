import { INestApplication, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    console.log("[PROVIDER] PrismaService constructor executed");
  }

  async onModuleInit(): Promise<void> {
    console.log("[PROVIDER] PrismaService onModuleInit - connecting to database");
    try {
      await this.$connect();
      console.log("[PROVIDER] PrismaService onModuleInit - connected successfully");
    } catch (error) {
      console.error("[PROVIDER] PrismaService onModuleInit - connection failed:", error.stack);
      throw error;
    }
  }

  async enableShutdownHooks(app: INestApplication): Promise<void> {
    // No-op with modern Nest; kept for compatibility
    app.enableShutdownHooks();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
