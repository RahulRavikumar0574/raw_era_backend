const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module');

let cachedServer;

async function bootstrapServer() {
  if (cachedServer) return cachedServer;

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'https://raw-era-frontend.vercel.app',
      'http://localhost:3000',
      'http://localhost:5173'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  });

  await app.init();
  cachedServer = app.getHttpAdapter().getInstance();
  return cachedServer;
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', 'https://raw-era-frontend.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return res.status(200).end();
  }

  try {
    const server = await bootstrapServer();
    return server(req, res);
  } catch (error) {
    console.error("CRITICAL NESTJS BOOTSTRAP FAILURE:", error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      message: "NestJS Bootstrap Failed during server execution.",
      error: error.message,
      stack: error.stack
    });
  }
};
