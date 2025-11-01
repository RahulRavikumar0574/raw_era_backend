import { INestApplication, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication): Promise<void> {
    // No-op with modern Nest; kept for compatibility
    app.enableShutdownHooks();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
