const { NestFactory } = require('@nestjs/core');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const appModulePath = path.join(distDir, 'src', 'app.module.js');
const chatServicePath = path.join(distDir, 'src', 'chat', 'chat.service.js');

let appContext;
let chatService;

function logDir(label, dirPath) {
  try {
    const entries = fs.readdirSync(dirPath);
    console.log(`[BOOT] ${label}:`, dirPath, '->', entries);
  } catch (error) {
    console.log(`[BOOT] ${label}:`, dirPath, '-> unavailable:', error.message);
  }
}

async function getChatService() {
  console.log('[BOOT 1] Handler entered');

  if (appContext && chatService) {
    console.log('[BOOT] Returning cached ChatService');
    return chatService;
  }

  console.log('[BOOT 2] __dirname:', __dirname);
  console.log('[BOOT 3] process.cwd():', process.cwd());
  console.log('[BOOT 4] projectRoot:', projectRoot);
  console.log('[BOOT 5] resolved AppModule path:', appModulePath);
  console.log('[BOOT 6] AppModule exists:', fs.existsSync(appModulePath));

  logDir('projectRoot', projectRoot);
  logDir('distDir', distDir);
  logDir('dist/src', path.join(distDir, 'src'));

  if (!fs.existsSync(appModulePath)) {
    throw new Error(`AppModule not found at ${appModulePath}`);
  }

  console.log('[BOOT 7] Loading AppModule');
  const { AppModule } = require(appModulePath);
  console.log('[BOOT 8] AppModule loaded');

  console.log('[BOOT 9] Creating ApplicationContext');
  appContext = await NestFactory.createApplicationContext(AppModule, { logger: false });
  console.log('[BOOT 10] ApplicationContext created');

  console.log('[BOOT 11] Resolving ChatService');
  const { ChatService } = require(chatServicePath);
  chatService = appContext.get(ChatService);
  console.log('[BOOT 12] ChatService resolved');

  return chatService;
}

module.exports = async (req, res) => {
  try {
    console.log('[HANDLER] Request received:', req.method, req.url);

    res.setHeader('Access-Control-Allow-Origin', 'https://raw-era-frontend.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Accept, Origin, X-Requested-With',
    );
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      console.log('[HANDLER] OPTIONS preflight - returning 200');
      return res.status(200).end();
    }

    if (req.url.includes('/chat') && req.method === 'POST') {
      try {
        console.log('[HANDLER] POST /chat - getting ChatService');
        const service = await getChatService();

        console.log('[HANDLER] POST /chat - executing chat method');
        const result = await service.chat(req.body.messages, req.body.sessionId);

        console.log('[HANDLER] POST /chat - returning response');
        return res.status(200).json(result);
      } catch (dispatchError) {
        console.error('[HANDLER] Dispatch error:', dispatchError.stack);
        return res.status(500).json({
          message: 'Micro-context invocation failed.',
          error: dispatchError.message,
          stack: dispatchError.stack,
        });
      }
    }

    console.log('[HANDLER] Route not handled:', req.url);
    return res.status(404).json({ message: `Route ${req.url} not handled by serverless dispatcher.` });
  } catch (handlerError) {
    console.error('[HANDLER CRITICAL] Handler failed:', handlerError.stack);
    return res.status(500).json({
      message: 'Handler execution failed.',
      error: handlerError.message,
      stack: handlerError.stack,
    });
  }
};
