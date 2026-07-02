import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  // Validate critical environment variables
  const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar] && envVar !== 'JWT_SECRET'
  );

  // Check JWT_SECRET or JWT_ACCESS_TOKEN_SECRET
  if (!process.env.JWT_SECRET && !process.env.JWT_ACCESS_TOKEN_SECRET) {
    missingEnvVars.push('JWT_SECRET');
  }

  if (!process.env.DATABASE_URL) {
    missingEnvVars.push('DATABASE_URL');
  }

  if (missingEnvVars.length > 0) {
    console.error(
      `❌ FATAL: Missing required environment variables: ${missingEnvVars.join(', ')}`
    );
    console.error('Please set these variables in your Railway environment:');
    missingEnvVars.forEach((envVar) => {
      console.error(`  - ${envVar}`);
    });
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);

  // CORS configuration - Allow specific origins for deployment and local development
  app.enableCors({
    origin: [
      'https://raw-era-frontend.vercel.app',
      'http://localhost:3000',
      'http://localhost:5173',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'],
  });

  // Cookie parsing for httpOnly JWT cookies
  app.use(cookieParser.default());

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

  const port = process.env.PORT || 4001;
  await app.listen(port);
  console.log(`✅ Nest application successfully started on port ${port}`);
}

bootstrap().catch((error) => {
  console.error('❌ Failed to bootstrap application:', error);
  process.exit(1);
});

