import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ChatToolsService } from './tools/chat-tools.service';
import knowledgeBase from './data/knowledge-base.json';
interface KnowledgeEntry {
  id: string;
  category: string;
  keywords: string[];
  content: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  imageData?: string;
  imageType?: string;
  tool_call_id?: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly knowledge: KnowledgeEntry[] = knowledgeBase as KnowledgeEntry[];
  private conversationContext: Map<string, any> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly chatTools: ChatToolsService,
  ) {
    console.log("knowledgeBase =", knowledgeBase);
    console.log("Array?", Array.isArray(knowledgeBase));
  }

  async chat(messages: ChatMessage[], sessionId?: string) {
    const userMessages = messages.filter((m) => m.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];
    const lastMessageContent = lastUserMessage?.content ?? '';
    const hasImage = !!lastUserMessage?.imageData;

    // Initialize or retrieve conversation context
    const effectiveSessionId = sessionId ?? this.generateSessionId();
    if (!this.conversationContext.has(effectiveSessionId)) {
      this.conversationContext.set(effectiveSessionId, {
        mentionedProducts: [],
      });
    }
    const context = this.conversationContext.get(effectiveSessionId);

    const retrievedDocs = this.retrieveRelevantDocs(lastMessageContent);

    const systemPrompt = this.buildToolCallingSystemPrompt(retrievedDocs, hasImage);

    const apiKey = this.config.get<string>('OPENAI_API_KEY');

if (!apiKey) {
  this.logger.error('OPENAI_API_KEY not found');
  return {
    message: this.fallbackResponse(retrievedDocs),
    sessionId: effectiveSessionId,
    sources: retrievedDocs.map((d) => d.id),
  };
}

    const model = this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o';

    console.log("========== OPENAI CONFIG ==========");
    console.log("API Key exists:", !!apiKey);
    console.log("Model:", model);
    console.log("===================================");

  

    // Define tools for OpenAI
    const tools = this.getToolDefinitions();

    console.log('\n========== OPENAI REQUEST CONFIG ==========');
    console.log('Model:', model);
    console.log('Tools count:', tools.length);
    console.log('Tool names:', tools.map((t: any) => t.function.name));
    console.log('Tool choice: auto');
    console.log('==========================================\n');

    // Convert messages to OpenAI format with vision support
    const openaiMessages = messages.slice(-10).map((msg) => {
      if (msg.imageData && msg.role === 'user') {
        return {
          role: msg.role,
          content: [
            { type: 'text', text: msg.content },
            {
              type: 'image_url',
              image_url: {
                url: `data:${msg.imageType};base64,${msg.imageData}`,
              },
            },
          ],
        };
      }
      return { role: msg.role, content: msg.content };
    });

    try {
      // Tool-calling loop
      let finalMessages = [{ role: 'system', content: systemPrompt }, ...openaiMessages];
      let maxIterations = 5;
      let iteration = 0;

      while (iteration < maxIterations) {
        iteration++;

        const requestBody = {
          model,
          messages: finalMessages,
          tools,
          tool_choice: 'auto',
          temperature: 0.7,
          max_tokens: 800,
        };

        console.log('\n========== OPENAI REQUEST BODY ==========');
        console.log('Iteration:', iteration);
        console.log('Messages count:', finalMessages.length);
        const lastMsg = finalMessages[finalMessages.length - 1];
        const lastMsgContent = typeof lastMsg?.content === 'string' ? lastMsg.content.substring(0, 100) : 'Array content (image)';
        console.log('Last user message:', lastMsgContent);
        console.log('Request body:', JSON.stringify(requestBody, null, 2));
        console.log('==========================================\n');

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const err = await response.text();
          this.logger.error(`OpenAI API error: ${err}`);
          return {
            message: this.fallbackResponse(retrievedDocs),
            sessionId: effectiveSessionId,
            sources: retrievedDocs.map((d) => d.id),
          };
        }

        const data = await response.json();
        const assistantMessage = data.choices?.[0]?.message;

        console.log('\n========== OPENAI RESPONSE ==========');
        console.log('Status:', response.status);
        console.log('Has tool_calls:', !!(assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0));
        if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
          console.log('Tool calls:', assistantMessage.tool_calls.map((tc: any) => ({
            id: tc.id,
            function: tc.function.name,
            args: tc.function.arguments
          })));
        }
        console.log('Assistant message content:', assistantMessage?.content?.substring(0, 200) || 'No content');
        console.log('Full response:', JSON.stringify(data, null, 2));
        console.log('=====================================\n');

        if (!assistantMessage) {
          return {
            message: this.fallbackResponse(retrievedDocs),
            sessionId: effectiveSessionId,
            sources: retrievedDocs.map((d) => d.id),
          };
        }

        // If no tool calls, return the response
        if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
          console.log('⚠️  NO TOOL CALLS RETURNED - GPT responded directly without using tools');
          // Update context if products were mentioned
          const content = assistantMessage.content || '';
          this.updateContextFromResponse(content, context);

          return {
            message: assistantMessage.content?.trim() || this.fallbackResponse(retrievedDocs),
            sessionId: effectiveSessionId,
            sources: retrievedDocs.map((d) => d.id),
          };
        }

        console.log('✓ Tool calls detected, executing tools...');
        // Execute tool calls
        finalMessages.push(assistantMessage);

        const toolResults = await this.executeToolCalls(assistantMessage.tool_calls, context);

        console.log('\n========== TOOL EXECUTION RESULTS ==========');
        console.log('Tool results:', JSON.stringify(toolResults, null, 2));
        console.log('============================================\n');

        // Append tool results to messages
        for (const toolCall of assistantMessage.tool_calls) {
          const result = toolResults[toolCall.id];
          finalMessages.push({
            role: 'tool' as const,
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          } as any);
        }
      }

      // Max iterations reached, return last response
      const lastMessage = finalMessages[finalMessages.length - 1];
      return {
        message: typeof lastMessage === 'string' ? lastMessage : (lastMessage as any).content || this.fallbackResponse(retrievedDocs),
        sessionId: effectiveSessionId,
        sources: retrievedDocs.map((d) => d.id),
      };
    } catch (error) {
      this.logger.error('Chat completion failed', error);
      return {
        message: this.fallbackResponse(retrievedDocs),
        sessionId: effectiveSessionId,
        sources: retrievedDocs.map((d) => d.id),
      };
    }
  }

  private retrieveRelevantDocs(query: string, limit = 5): KnowledgeEntry[] {
  console.log("this =", this);
  console.log("this.knowledge =", this.knowledge);
  console.log("isArray =", Array.isArray(this.knowledge));

  const normalized = query.toLowerCase();
    const tokens = normalized.split(/\s+/).filter((t) => t.length > 2);

    const scored = this.knowledge.map((entry) => {
      let score = 0;
      for (const keyword of entry.keywords) {
        if (normalized.includes(keyword.toLowerCase())) score += 3;
      }
      for (const token of tokens) {
        if (entry.content.toLowerCase().includes(token)) score += 1;
        if (entry.category.includes(token)) score += 2;
      }
      return { entry, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.entry);
  }

  /**
   * Get OpenAI tool definitions for function calling
   */
  private getToolDefinitions() {
    return [
      {
        type: 'function',
        function: {
          name: 'searchProducts',
          description: 'Search for products by name, category, description, or tags. Returns product details including price, stock, and variants.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query - product name, category, or keywords',
              },
              categoryId: {
                type: 'string',
                description: 'Optional: Filter by category ID',
              },
              minPrice: {
                type: 'number',
                description: 'Optional: Minimum price filter',
              },
              maxPrice: {
                type: 'number',
                description: 'Optional: Maximum price filter',
              },
              inStock: {
                type: 'boolean',
                description: 'Optional: Only show in-stock items',
              },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'getProductInventory',
          description: 'Get live inventory data for a specific product including available sizes, colors, and stock levels.',
          parameters: {
            type: 'object',
            properties: {
              productId: {
                type: 'string',
                description: 'Product ID to check inventory for',
              },
            },
            required: ['productId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'getProductPricing',
          description: 'Get current pricing information including discounts, sale prices, and variant-specific pricing.',
          parameters: {
            type: 'object',
            properties: {
              productId: {
                type: 'string',
                description: 'Product ID to get pricing for',
              },
            },
            required: ['productId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'getActiveCoupons',
          description: 'Get list of currently active coupons and discount codes.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'getShippingInfo',
          description: 'Get shipping configuration including costs and delivery timelines.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'getOrderStatus',
          description: 'Get order status and tracking information by order number.',
          parameters: {
            type: 'object',
            properties: {
              orderId: {
                type: 'string',
                description: 'Order number (e.g., ORD12345)',
              },
            },
            required: ['orderId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'getRecommendations',
          description: 'Get product recommendations based on context. Can recommend similar products, items in a category, or based on a query.',
          parameters: {
            type: 'object',
            properties: {
              productId: {
                type: 'string',
                description: 'Optional: Get products similar to this product ID',
              },
              category: {
                type: 'string',
                description: 'Optional: Get recommendations from this category',
              },
              query: {
                type: 'string',
                description: 'Optional: Search-based recommendations',
              },
              limit: {
                type: 'number',
                description: 'Optional: Number of recommendations to return (default: 5)',
              },
            },
          },
        },
      },
    ];
  }

  /**
   * Execute tool calls requested by OpenAI
   */
  private async executeToolCalls(toolCalls: any[], context: any) {
    const results: Record<string, any> = {};

    for (const toolCall of toolCalls) {
      const functionName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments || '{}');

      try {
        let result;
        switch (functionName) {
          case 'searchProducts':
            result = await this.chatTools.searchProducts(args.query, {
              categoryId: args.categoryId,
              minPrice: args.minPrice,
              maxPrice: args.maxPrice,
              inStock: args.inStock,
            });
            // Update context with found products
            if (result.length > 0) {
              context.mentionedProducts = result.map((p: any) => ({ id: p.id, name: p.name }));
            }
            break;
          case 'getProductInventory':
            result = await this.chatTools.getProductInventory(args.productId);
            break;
          case 'getProductPricing':
            result = await this.chatTools.getProductPricing(args.productId);
            break;
          case 'getActiveCoupons':
            result = await this.chatTools.getActiveCoupons();
            break;
          case 'getShippingInfo':
            result = await this.chatTools.getShippingInfo();
            break;
          case 'getOrderStatus':
            result = await this.chatTools.getOrderStatus(args.orderId);
            break;
          case 'getRecommendations':
            result = await this.chatTools.getRecommendations({
              productId: args.productId,
              category: args.category,
              query: args.query,
              limit: args.limit || 5,
            });
            break;
          default:
            result = { error: `Unknown function: ${functionName}` };
        }
        results[toolCall.id] = result;
      } catch (error) {
        this.logger.error(`Tool execution error for ${functionName}:`, error);
        results[toolCall.id] = { error: `Failed to execute ${functionName}: ${error}` };
      }
    }

    return results;
  }

  /**
   * Update conversation context from response
   */
  private updateContextFromResponse(content: string, context: any) {
    // Extract product names mentioned in response
    const productPattern = /(?:product|item|style|hoodie|t-shirt|shirt|tee|jacket|pants|jeans)/gi;
    if (productPattern.test(content)) {
      // Context is already updated by tool execution
      // This is a fallback for cases where tools weren't called
    }
  }

  /**
   * Build system prompt for tool-calling architecture
   */
  private buildToolCallingSystemPrompt(docs: KnowledgeEntry[], hasImage?: boolean): string {
    const docContext =
      docs.length > 0
        ? docs.map((d) => `[${d.category}] ${d.content}`).join('\n\n')
        : 'No specific FAQ documents matched this query.';

    const imageInstructions = hasImage ? `
IMAGE ANALYSIS INSTRUCTIONS:
The user has uploaded an image. Use GPT Vision to:
1. Identify the garment type (t-shirt, hoodie, polo, etc.)
2. Identify colors in the design
3. Identify print style (logo, graphic, text, pattern)
4. Identify logo placement (chest, back, sleeve, all-over)
5. Estimate print size

Then use the searchProducts tool to find SIMILAR items in the catalog.
ONLY recommend products that actually exist in the database.
Do not invent products or suggest items not found in the catalog.
` : '';

    return `You are a knowledgeable and friendly fashion consultant for "The Raw Era", a premium fashion ecommerce store in India.

CRITICAL RULE - TOOL USAGE IS MANDATORY:
When users ask about products, clothing, items, styles, or anything related to the catalog:
- You MUST use the searchProducts tool
- Do NOT answer from general knowledge
- Do NOT answer from the knowledge base for product-related questions
- The knowledge base is ONLY for policies (returns, refunds, contact, shipping policies)

EXAMPLES OF QUERIES THAT REQUIRE searchProducts:
- "show me hoodies"
- "do you have t-shirts"
- "oversized tees"
- "black tshirts"
- "gym wear"
- "what products do you have"
- "show me [any clothing item]"
- "do you sell [any product]"
- "[product name] in [size/color]"

EXAMPLES OF QUERIES THAT USE KNOWLEDGE BASE (no tools needed):
- "what is your return policy"
- "how do I get a refund"
- "contact information"
- "shipping policy"
- "customization policy"

AVAILABLE TOOLS:
- searchProducts: Find products by name, category, description, or tags (USE THIS FOR ALL PRODUCT QUERIES)
- getProductInventory: Check live inventory for sizes, colors, and stock
- getProductPricing: Get current prices, discounts, and sale information
- getActiveCoupons: Retrieve active discount codes
- getShippingInfo: Get shipping costs and delivery timelines
- getOrderStatus: Track order by order number
- getRecommendations: Get product recommendations

TOOL USAGE RULES:
1. For ANY product-related question: ALWAYS call searchProducts first
2. For inventory/size/color questions: Use getProductInventory (after getting product ID from searchProducts)
3. For pricing questions: Use getProductPricing (after getting product ID from searchProducts)
4. For coupon questions: Use getActiveCoupons
5. For shipping questions: Use getShippingInfo
6. For order tracking: Use getOrderStatus
7. For recommendations: Use getRecommendations
8. For policy questions (returns, refunds, contact): Use the KNOWLEDGE BASE below - DO NOT call tools

KNOWLEDGE BASE (for policies and company info ONLY - NOT for products):
${docContext}

${imageInstructions}

RESPONSE GUIDELINES:
- Be warm, professional, and helpful
- Use INR (₹) for all prices
- Mention stock availability when relevant
- Suggest alternatives if requested item is unavailable
- Explain why you're recommending certain products
- If multiple products match, ask which one they're interested in
- For follow-up questions about "the second one" or similar, reference the conversation history
- When tools return data, present it naturally to the user
- Don't show raw JSON or database fields to the user`;
  }

  private fallbackResponse(docs: KnowledgeEntry[]) {
    if (docs.length > 0) {
      return docs[0].content;
    }
    return "I'm sorry, I don't have specific information about that. Please contact our support team at Info@rawera.com or call +91 99468 12233. Our team is happy to help!";
  }

  private generateSessionId(): string {
    return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
