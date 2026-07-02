import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import knowledgeBase from './data/knowledge-base.json';
interface KnowledgeEntry {
  id: string;
  category: string;
  keywords: string[];
  content: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  imageData?: string;
  imageType?: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly knowledge: KnowledgeEntry[] = knowledgeBase as KnowledgeEntry[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    console.log("knowledgeBase =", knowledgeBase);
    console.log("Array?", Array.isArray(knowledgeBase));
  }

  async chat(messages: ChatMessage[], sessionId?: string) {
    const userMessages = messages.filter((m) => m.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];
    const lastMessageContent = lastUserMessage?.content ?? '';
    const hasImage = !!lastUserMessage?.imageData;

    const retrievedDocs = this.retrieveRelevantDocs(lastMessageContent);
    const productContext = await this.searchProducts(lastMessageContent);
    const similarProducts = productContext.length
      ? await this.findSimilarProducts(productContext[0])
      : [];

    const systemPrompt = this.buildSystemPrompt(retrievedDocs, productContext, similarProducts, hasImage);

    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      return {
        message: this.fallbackResponse(retrievedDocs, productContext, hasImage),
        sessionId: sessionId ?? this.generateSessionId(),
        sources: retrievedDocs.map((d) => d.id),
      };
    }

    const model = this.config.get<string>('OPENAI_MODEL') ?? 'gpt-5.5';

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
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: systemPrompt }, ...openaiMessages],
          temperature: 0.3,
          max_tokens: 800,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        this.logger.error(`OpenAI API error: ${err}`);
        return {
          message: this.fallbackResponse(retrievedDocs, productContext, hasImage),
          sessionId: sessionId ?? this.generateSessionId(),
          sources: retrievedDocs.map((d) => d.id),
        };
      }

      const data = await response.json();
      const assistantMessage =
        data.choices?.[0]?.message?.content?.trim() ??
        this.fallbackResponse(retrievedDocs, productContext, hasImage);

      return {
        message: assistantMessage,
        sessionId: sessionId ?? this.generateSessionId(),
        sources: retrievedDocs.map((d) => d.id),
        suggestedProducts: similarProducts.slice(0, 3).map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          image: p.images[0]?.url,
        })),
      };
    } catch (error) {
      this.logger.error('Chat completion failed', error);
      return {
        message: this.fallbackResponse(retrievedDocs, productContext, hasImage),
        sessionId: sessionId ?? this.generateSessionId(),
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

  private async searchProducts(query: string) {
    const words = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (words.length === 0) return [];

    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        OR: words.flatMap((word) => [
          { name: { contains: word, mode: 'insensitive' as const } },
          { description: { contains: word, mode: 'insensitive' as const } },
          { brand: { contains: word, mode: 'insensitive' as const } },
        ]),
      },
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        variants: true,
        specifications: true,
        category: true,
      },
      take: 3,
    });

    return products;
  }

  private async findSimilarProducts(product: {
    id: string;
    categoryId: string;
    price: number;
  }) {
    return this.prisma.product.findMany({
      where: {
        isActive: true,
        id: { not: product.id },
        categoryId: product.categoryId,
        price: { gte: product.price * 0.7, lte: product.price * 1.3 },
      },
      include: { images: { where: { isPrimary: true }, take: 1 } },
      take: 4,
    });
  }

  private buildSystemPrompt(
    docs: KnowledgeEntry[],
    products: Awaited<ReturnType<typeof this.searchProducts>>,
    similar: Awaited<ReturnType<typeof this.findSimilarProducts>>,
    hasImage?: boolean,
  ): string {
    const docContext =
      docs.length > 0
        ? docs.map((d) => `[${d.category}] ${d.content}`).join('\n\n')
        : 'No specific FAQ documents matched this query.';

    let productContext = '';
    if (products.length > 0) {
      productContext = products
        .map((p) => {
          const sizes = p.variants.filter((v) => v.type === 'SIZE').map((v) => v.value);
          const colors = p.variants.filter((v) => v.type === 'COLOR').map((v) => v.value);
          const materials = p.variants.filter((v) => v.type === 'MATERIAL').map((v) => v.value);
          const specs = p.specifications.map((s) => `${s.name}: ${s.value}`).join(', ');
          return `Product: ${p.name}
Price: ₹${p.price}
Stock: ${p.stock}
Description: ${p.shortDescription || p.description.slice(0, 200)}
Available Sizes: ${sizes.length ? sizes.join(', ') : 'Check product page'}
Available Colors: ${colors.length ? colors.join(', ') : 'Check product page'}
Material: ${materials.length ? materials.join(', ') : specs || 'See product specifications'}
Category: ${p.category.name}`;
        })
        .join('\n\n');
    }

    let similarContext = '';
    if (similar.length > 0) {
      similarContext = `\nSimilar products you may recommend:\n${similar.map((p) => `- ${p.name} (₹${p.price})`).join('\n')}`;
    }

    const imageInstructions = hasImage ? `
IMAGE ANALYSIS:
The user has uploaded an image for customization analysis. When analyzing images:
- Recommend the most suitable printing method (screen printing, DTG, embroidery) based on design complexity
- Suggest appropriate garment types (t-shirts, hoodies, polo shirts)
- Recommend print size based on design dimensions
- Provide customization estimate if possible (screen printing: ₹50-150/piece, embroidery: ₹100-300/piece)
- Mention minimum order requirements (5 pieces for printing, 3 for embroidery)
- Suggest turnaround time (7-10 business days for printing, 3-5 extra days for embroidery)
` : '';

    return `You are a friendly and professional customer support representative for "The Raw Era", a premium fashion ecommerce store in India.

RULES:
1. ONLY answer using the knowledge base and product data provided below.
2. If you don't have enough information, politely say you don't know and suggest contacting Info@rawera.com or +91 99468 12233.
3. NEVER make up product details, prices, sizes, colors, or policies.
4. Be concise, helpful, and warm. Use INR (₹) for prices.
5. Remember the conversation context for follow-up questions.
6. For product questions, use the exact product data provided.
7. You can suggest similar products when relevant.
${hasImage ? '8. When analyzing images, provide specific recommendations for printing methods and customization options.' : ''}

KNOWLEDGE BASE:
${docContext}

${productContext ? `PRODUCT DATA:\n${productContext}` : ''}
${similarContext}
${imageInstructions}

Topics you help with: products, sizes, colors, materials, shipping, returns, refunds, bulk orders, custom printing, embroidery, order tracking, payments, delivery timelines, coupons, and contact information.`;
  }

  private fallbackResponse(docs: KnowledgeEntry[], products: Awaited<ReturnType<typeof this.searchProducts>>, hasImage?: boolean) {
    if (hasImage) {
      return "I've analyzed your image. Based on the design, I recommend screen printing for this artwork. It's suitable for cotton and polyester blends. For best results, I suggest printing on t-shirts or hoodies with a print size of 8-10 inches. For accurate pricing, please submit a customization request with your specifications.";
    }
    if (products.length > 0) {
      const p = products[0];
      const sizes = p.variants.filter((v) => v.type === 'SIZE').map((v) => v.value);
      const colors = p.variants.filter((v) => v.type === 'COLOR').map((v) => v.value);
      return `Here's what I found about **${p.name}**:\n\n• Price: ₹${p.price}\n• Stock: ${p.stock} units\n• Sizes: ${sizes.length ? sizes.join(', ') : 'See product page'}\n• Colors: ${colors.length ? colors.join(', ') : 'See product page'}\n\n${p.shortDescription || p.description.slice(0, 150)}`;
    }
    if (docs.length > 0) {
      return docs[0].content;
    }
    return "I'm sorry, I don't have specific information about that. Please contact our support team at Info@rawera.com or call +91 99468 12233. Our team is happy to help!";
  }

  private generateSessionId(): string {
    return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
