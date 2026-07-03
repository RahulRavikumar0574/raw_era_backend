import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  async getAnalytics(@Query('timeRange') timeRange = '30d') {
    return this.analyticsService.getDashboardAnalytics(timeRange);
  }
}
