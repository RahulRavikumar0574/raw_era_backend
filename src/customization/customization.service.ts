import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomizationRequestDto } from './dto/customization.dto';
import { sanitizeText, sanitizeEmail } from '../common/sanitize.util';

@Injectable()
export class CustomizationService {
  constructor(private readonly prisma: PrismaService) {}

  async createRequest(dto: CreateCustomizationRequestDto, customerId?: string) {
    const request = await this.prisma.customizationRequest.create({
      data: {
        customerId: customerId ?? null,
        productId: dto.productId ?? null,
        customerName: sanitizeText(dto.customerName),
        customerEmail: sanitizeEmail(dto.customerEmail),
        customerPhone: dto.customerPhone ? sanitizeText(dto.customerPhone) : null,
        description: sanitizeText(dto.description),
        additionalNotes: dto.additionalNotes ? sanitizeText(dto.additionalNotes) : null,
        images: dto.images?.length
          ? {
              create: dto.images.map((img) => ({
                url: img.imageUrl,
                publicId: img.publicId,
                fileName: sanitizeText(img.fileName),
              })),
            }
          : undefined,
      },
      include: {
        images: true,
        product: { include: { images: { where: { isPrimary: true }, take: 1 } } },
      },
    });

    return request;
  }

  async getById(id: string) {
    const request = await this.prisma.customizationRequest.findUnique({
      where: { id },
      include: {
        images: true,
        product: { include: { images: { where: { isPrimary: true }, take: 1 } } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!request) {
      throw new NotFoundException('Customization request not found');
    }

    return request;
  }

  async listAll() {
    return this.prisma.customizationRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        images: true,
        product: { select: { id: true, name: true, sku: true } },
      },
    });
  }
}
