import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PaymentsModule } from './payments/payments.module';
import { OrdersModule } from './orders/orders.module';
import { CatalogModule } from './catalog/catalog.module';
import { CartModule } from './cart/cart.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ReviewsModule } from './reviews/reviews.module';
import { AddressModule } from './address/address.module';
import { CouponModule } from './coupon/coupon.module';
import { SettingsModule } from './settings/settings.module';
import { ChatModule } from './chat/chat.module';
import { CustomizationModule } from './customization/customization.module';
import { UsersModule } from './users/users.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    PaymentsModule,
    OrdersModule,
    CatalogModule,
    CartModule,
    WishlistModule,
    ReviewsModule,
    AddressModule,
    CouponModule,
    SettingsModule,
    ChatModule,
    CustomizationModule,
    UsersModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }),
    },
  ],
})
export class AppModule {
  constructor() {
    console.log("[PROVIDER] AppModule constructor executed");
  }
}
