// server.js
const { createServer } = require('http');
const { parse } = require('url');
const cors = require('cors');
const express = require('express');
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { AppModule } = require('./dist/app.module');

const app = express();

// Enable CORS for all routes
app.use(cors({
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type,Authorization,X-Requested-With,Accept,Origin',
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Handle OPTIONS requests
app.options('*', (req, res) => {
  res.status(204).end();
});

async function bootstrap() {
  const nestApp = await NestFactory.create(
    AppModule,
    new ExpressAdapter(app),
  );
  
  await nestApp.init();
  
  return app;
}

// Start the server
bootstrap().then(app => {
  createServer(app).listen(process.env.PORT || 3000, () => {
    console.log(`Server running on port ${process.env.PORT || 3000}`);
  });
});

// For Vercel serverless deployment
module.exports = bootstrap();