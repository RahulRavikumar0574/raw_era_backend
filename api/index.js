const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module');

let appContext;
let chatService;

async function getChatService() {
  if (!appContext) {
    console.log("[SERVERLESS BOOT] Initializing micro NestJS Application Context...");
    // Boot up purely the DI container without Express or any HTTP layer overhead
    appContext = await NestFactory.createApplicationContext(AppModule, { logger: false });
    
    // Resolve the ChatService directly from the compiled dependency graph
    chatService = appContext.get('ChatService'); 
    console.log("[SERVERLESS BOOT] ChatService successfully extracted from DI graph.");
  }
  return chatService;
}

module.exports = async (req, res) => {
  // 1. Instantly clear CORS obstacles at the edge
  res.setHeader('Access-Control-Allow-Origin', 'https://raw-era-frontend.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Enforce structural routing for the /chat route explicitly
  if (req.url.includes('/chat') && req.method === 'POST') {
    try {
      const service = await getChatService();
      
      // Directly invoke chat service method, bypassing Nest controllers and HTTP layers
      // ChatService.chat() expects (messages: ChatMessage[], sessionId?: string)
      const result = await service.chat(req.body.messages, req.body.sessionId);
      
      return res.status(200).json(result);
    } catch (error) {
      console.error("[DISPATCH ERROR] Failed to execute ChatService method:", error);
      return res.status(500).json({
        message: "Micro-context invocation failed.",
        error: error.message,
        stack: error.stack
      });
    }
  }

  // Catch-all fallback for other routes if needed
  return res.status(404).json({ message: `Route ${req.url} not handled by serverless dispatcher.` });
};
