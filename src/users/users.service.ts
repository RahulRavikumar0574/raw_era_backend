import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listAllUsers() {
    const users = await this.prisma.user.findMany({
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
        },
        addresses: {
          where: { isDefault: true },
          take: 1,
        },
      },
    });

    return users.map((user) => {
      const activeOrders = user.orders.filter((o) => o.status !== 'CANCELLED');
      const totalSpent = activeOrders.reduce((sum, order) => sum + order.total, 0);
      const lastOrder = user.orders[0];
      const address = user.addresses[0];

      return {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        phone: user.phone || undefined,
        avatar: user.avatarUrl || undefined,
        totalOrders: user.orders.length,
        totalSpent,
        status: user.isActive ? 'active' : 'inactive',
        joinedDate: user.createdAt.toISOString(),
        lastOrderDate: lastOrder ? lastOrder.createdAt.toISOString() : undefined,
        address: address
          ? {
              city: address.city,
              state: address.state,
              country: address.country,
            }
          : undefined,
      };
    });
  }
}
