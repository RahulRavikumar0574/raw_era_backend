const { NestFactory } = require('@nestjs/core');

// 1. Force Vercel's static analysis bundler to notice and include the compiled NestJS source files
try {
  if (false) {
    require('../dist/src/app.module');
  }
} catch (e) {}

let cachedServer;

async function bootstrapServer() {
  if (cachedServer) return cachedServer;

  console.log("[BOOT] Starting sanity checks...");
  const criticalEnvVars = ["DATABASE_URL", "OPENAI_API_KEY", "JWT_ACCESS_TOKEN_SECRET"];
  for (const key of criticalEnvVars) {
    if (!process.env[key]) {
      throw new Error(`[SANITY FAIL] Missing critical environment variable: ${key}`);
    }
  }

  let AppModule;
  try {
    console.log("[BOOT] Loading AppModule...");
    // Using the explicit relative path that matches what Vercel traced
    AppModule = require('../dist/src/app.module').AppModule;
    console.log("[BOOT] AppModule successfully required.");
  } catch (requireError) {
    console.error("[CRITICAL] Failed to require AppModule:", requireError);
    throw new Error(`Module Resolution Failure: ${requireError.message}`);
  }

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
      message: "NestJS Bootstrap Failed within dynamic wrapper execution window.",
      error: error.message,
      stack: error.stack
    });
  }
};
