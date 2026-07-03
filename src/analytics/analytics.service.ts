import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardAnalytics(timeRange: string) {
    const now = new Date();
    let days = 30;
    if (timeRange === '7d') days = 7;
    else if (timeRange === '24h') days = 1;
    else if (timeRange === '90d') days = 90;
    else if (timeRange === '365d') days = 365;

    const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousStart = new Date(now.getTime() - 2 * days * 24 * 60 * 60 * 1000);

    // 1. Revenue
    const currentRevenueResult = await this.prisma.order.aggregate({
      where: {
        createdAt: { gte: currentStart },
        status: { not: 'CANCELLED' },
      },
      _sum: { total: true },
    });
    const currentRevenue = currentRevenueResult._sum.total || 0;

    const previousRevenueResult = await this.prisma.order.aggregate({
      where: {
        createdAt: { gte: previousStart, lt: currentStart },
        status: { not: 'CANCELLED' },
      },
      _sum: { total: true },
    });
    const previousRevenue = previousRevenueResult._sum.total || 0;

    // 2. Orders
    const currentOrders = await this.prisma.order.count({
      where: {
        createdAt: { gte: currentStart },
        status: { not: 'CANCELLED' },
      },
    });
    const previousOrders = await this.prisma.order.count({
      where: {
        createdAt: { gte: previousStart, lt: currentStart },
        status: { not: 'CANCELLED' },
      },
    });

    // 3. Customers
    const currentCustomers = await this.prisma.user.count({
      where: {
        createdAt: { gte: currentStart },
        role: 'CUSTOMER',
      },
    });
    const previousCustomers = await this.prisma.user.count({
      where: {
        createdAt: { gte: previousStart, lt: currentStart },
        role: 'CUSTOMER',
      },
    });

    // 4. Reviews
    const currentReviews = await this.prisma.review.count({
      where: { createdAt: { gte: currentStart } },
    });
    const previousReviews = await this.prisma.review.count({
      where: { createdAt: { gte: previousStart, lt: currentStart } },
    });

    // Growth rates
    const calculateGrowth = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return parseFloat((((curr - prev) / prev) * 100).toFixed(1));
    };

    const revenueGrowth = calculateGrowth(currentRevenue, previousRevenue);
    const ordersGrowth = calculateGrowth(currentOrders, previousOrders);
    const customersGrowth = calculateGrowth(currentCustomers, previousCustomers);
    const reviewsGrowth = calculateGrowth(currentReviews, previousReviews);

    // Dynamic KPIs list for the analytics page
    const kpis = [
      {
        id: 'revenue',
        title: 'Total Revenue',
        value: `₹${currentRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
        change: revenueGrowth,
        changeType: revenueGrowth >= 0 ? 'increase' : 'decrease',
        color: 'green',
        description: 'vs last period',
      },
      {
        id: 'orders',
        title: 'Total Orders',
        value: currentOrders.toLocaleString(),
        change: ordersGrowth,
        changeType: ordersGrowth >= 0 ? 'increase' : 'decrease',
        color: 'blue',
        description: 'vs last period',
      },
      {
        id: 'customers',
        title: 'New Customers',
        value: currentCustomers.toLocaleString(),
        change: customersGrowth,
        changeType: customersGrowth >= 0 ? 'increase' : 'decrease',
        color: 'purple',
        description: 'vs last period',
      },
      {
        id: 'reviews',
        title: 'Product Reviews',
        value: currentReviews.toLocaleString(),
        change: reviewsGrowth,
        changeType: reviewsGrowth >= 0 ? 'increase' : 'decrease',
        color: 'orange',
        description: 'vs last period',
      },
    ];

    // Sales data (daily bar chart) for dashboard
    const salesData: any[] = [];
    const chartDays = Math.min(days, 7); // keep it to 7 days for clean display if desired, or matching dashboard expectation (7 bars)
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

      const dayRevenue = await this.prisma.order.aggregate({
        where: {
          createdAt: { gte: startOfDay, lt: endOfDay },
          status: { not: 'CANCELLED' },
        },
        _sum: { total: true },
      });

      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      salesData.push({
        name: dayName,
        value: dayRevenue._sum.total || 0,
        color: '#f97316',
      });
    }

    // Top Selling Products
    const orderItemsGrouped = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 4,
    });

    const topProducts: any[] = [];
    for (const item of orderItemsGrouped) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
        include: { images: { where: { isPrimary: true }, take: 1 } },
      });
      if (product) {
        topProducts.push({
          id: product.id,
          name: product.name,
          sales: item._sum.quantity || 0,
          revenue: (item._sum.quantity || 0) * product.price,
          image: product.images[0]?.url || '',
        });
      }
    }

    // Order status counts
    const statuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    const orderStatuses: any[] = [];
    for (const status of statuses) {
      const count = await this.prisma.order.count({
        where: { status: status as any },
      });
      let color = 'yellow';
      if (status === 'PROCESSING') color = 'blue';
      else if (status === 'SHIPPED') color = 'purple';
      else if (status === 'DELIVERED') color = 'green';
      else if (status === 'CANCELLED') color = 'red';

      orderStatuses.push({
        status: status.charAt(0) + status.slice(1).toLowerCase(),
        count,
        color,
      });
    }

    return {
      kpis,
      salesData,
      topProducts,
      orderStatuses,
      summaryStats: {
        totalRevenue: currentRevenue,
        totalOrders: currentOrders,
        totalCustomers: currentCustomers,
        averageOrderValue: currentOrders > 0 ? currentRevenue / currentOrders : 0,
        revenueGrowth,
        ordersGrowth,
        customersGrowth,
        conversionRate: 3.2,
      },
    };
  }
}
