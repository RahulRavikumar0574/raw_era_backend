import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';
import serverlessExpress from '@vendia/serverless-express';
import { Callback, Context, Handler } from 'aws-lambda';

let cachedApp: any;
let cachedServer: Handler;

async function bootstrap() {
  if (!cachedApp) {
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

    await app.init();

    cachedApp = app;
  }

  return cachedApp;
}

// For local development
if (require.main === module) {
  bootstrap().then(() => {
    const port = process.env.PORT ?? 4001;
    console.log(`Server is running on port ${port}`);
    cachedApp.listen(port);
  }).catch((error) => {
    console.error('Failed to bootstrap application:', error);
    process.exit(1);
  });
}

// For Vercel serverless
export const handler: Handler = async (event: any, context: Context, callback: Callback) => {
  try {
    if (!cachedServer) {
      const app = await bootstrap();
      cachedServer = serverlessExpress({ app: app.getHttpAdapter().getInstance() });
    }
    return cachedServer(event, context, callback);
  } catch (error) {
    console.error('Error in serverless handler:', error);
    return callback(error);
  }
};
