import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS configuration
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
  app.enableCors({
    origin: allowedOrigin,
    credentials: true,
  });

  // Cookie parsing for httpOnly JWT cookies
  app.use(cookieParser());

  // Webhooks raw body (Razorpay + Stripe)
  app.use('/payments/webhook', bodyParser.raw({ type: '*/*' }));
  app.use('/payments/stripe/webhook', bodyParser.raw({ type: '*/*' }));

  // Swagger/OpenAPI setup
  const config = new DocumentBuilder()
    .setTitle('Souled Store API')
    .setDescription('API documentation for Souled Store backend')
    .setVersion('1.0.0')
    .addCookieAuth('access_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'access_token',
      description: 'JWT access token stored in httpOnly cookie',
    })
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 4001);
}
bootstrap();
