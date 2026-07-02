const { NestFactory } = require('@nestjs/core');
const path = require('path');
const fs = require('fs');

let appContext;
let chatService;

async function getChatService() {
  try {
    console.log("[BOOT 1] Handler entered");
    
    if (!appContext) {
      console.log("[BOOT 2] __dirname:", __dirname);
      console.log("[BOOT 3] process.cwd():", process.cwd());
      
      // Log directory structure
      try {
        console.log("[BOOT 3.1] Listing /var/task:");
        const taskFiles = fs.readdirSync('/var/task');
        console.log("[BOOT 3.1]", taskFiles);
      } catch (e) {
        console.log("[BOOT 3.1] Cannot list /var/task:", e.message);
      }
      
      try {
        console.log("[BOOT 3.2] Listing /var/task/api:");
        const apiFiles = fs.readdirSync('/var/task/api');
        console.log("[BOOT 3.2]", apiFiles);
      } catch (e) {
        console.log("[BOOT 3.2] Cannot list /var/task/api:", e.message);
      }
      
      try {
        console.log("[BOOT 3.3] Listing /var/task/dist:");
        const distFiles = fs.readdirSync('/var/task/dist');
        console.log("[BOOT 3.3]", distFiles);
      } catch (e) {
        console.log("[BOOT 3.3] Cannot list /var/task/dist:", e.message);
      }
      
      try {
        console.log("[BOOT 3.4] Listing /var/task/dist/src:");
        const srcFiles = fs.readdirSync('/var/task/dist/src');
        console.log("[BOOT 3.4]", srcFiles);
      } catch (e) {
        console.log("[BOOT 3.4] Cannot list /var/task/dist/src:", e.message);
      }
      
      try {
        console.log("[BOOT 4] Resolving AppModule path");
        const appModulePath = path.join(__dirname, '..', 'dist', 'src', 'app.module');
        console.log("[BOOT 5] Resolved app.module path:", appModulePath);
        
        try {
          const fileExists = fs.existsSync(appModulePath);
          console.log("[BOOT 6] File exists:", fileExists);
          
          if (!fileExists) {
            throw new Error(`AppModule file does not exist at: ${appModulePath}`);
          }
        } catch (fsError) {
          console.error("[BOOT 6] File system check failed:", fsError.stack);
          throw fsError;
        }
        
        try {
          console.log("[BOOT 7] Loading AppModule");
          const { AppModule } = require(appModulePath);
          console.log("[BOOT 8] AppModule loaded successfully");
          
          try {
            console.log("[BOOT 9] Creating ApplicationContext");
            appContext = await NestFactory.createApplicationContext(AppModule, { logger: false });
            console.log("[BOOT 10] ApplicationContext created successfully");
            
            try {
              console.log("[BOOT 11] Resolving ChatService");
              chatService = appContext.get('ChatService');
              console.log("[BOOT 12] ChatService resolved successfully");
            } catch (serviceError) {
              console.error("[BOOT 11] ChatService resolution failed:", serviceError.stack);
              if (serviceError.cause) {
                console.error("[BOOT 11] Error cause:", serviceError.cause.stack);
              }
              throw serviceError;
            }
          } catch (contextError) {
            console.error("[BOOT 9] ApplicationContext creation failed:", contextError.stack);
            if (contextError.cause) {
              console.error("[BOOT 9] Error cause:", contextError.cause.stack);
            }
            throw contextError;
          }
        } catch (requireError) {
          console.error("[BOOT 7] AppModule require failed:", requireError.stack);
          if (requireError.cause) {
            console.error("[BOOT 7] Error cause:", requireError.cause.stack);
          }
          throw requireError;
        }
      } catch (pathError) {
        console.error("[BOOT 4] Path resolution failed:", pathError.stack);
        if (pathError.cause) {
          console.error("[BOOT 4] Error cause:", pathError.cause.stack);
        }
        throw pathError;
      }
    }
    
    console.log("[BOOT 13] Returning cached ChatService");
    return chatService;
  } catch (bootError) {
    console.error("[BOOT CRITICAL] Bootstrap process failed:", bootError.stack);
    if (bootError.cause) {
      console.error("[BOOT CRITICAL] Error cause:", bootError.cause.stack);
    }
    throw bootError;
  }
}

module.exports = async (req, res) => {
  try {
    console.log("[HANDLER] Request received:", req.method, req.url);
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'https://raw-era-frontend.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      console.log("[HANDLER] OPTIONS preflight - returning 200");
      return res.status(200).end();
    }

    if (req.url.includes('/chat') && req.method === 'POST') {
      try {
        console.log("[HANDLER] POST /chat - getting ChatService");
        const service = await getChatService();
        
        console.log("[HANDLER] POST /chat - executing chat method");
        const result = await service.chat(req.body.messages, req.body.sessionId);
        
        console.log("[HANDLER] POST /chat - returning response");
        return res.status(200).json(result);
      } catch (dispatchError) {
        console.error("[HANDLER] Dispatch error:", dispatchError.stack);
        if (dispatchError.cause) {
          console.error("[HANDLER] Error cause:", dispatchError.cause.stack);
        }
        return res.status(500).json({
          message: "Micro-context invocation failed.",
          error: dispatchError.message,
          stack: dispatchError.stack
        });
      }
    }

    console.log("[HANDLER] Route not handled:", req.url);
    return res.status(404).json({ message: `Route ${req.url} not handled by serverless dispatcher.` });
  } catch (handlerError) {
    console.error("[HANDLER CRITICAL] Handler failed:", handlerError.stack);
    if (handlerError.cause) {
      console.error("[HANDLER CRITICAL] Error cause:", handlerError.cause.stack);
    }
    return res.status(500).json({
      message: "Handler execution failed.",
      error: handlerError.message,
      stack: handlerError.stack
    });
  }
};
