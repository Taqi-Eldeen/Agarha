import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog';
import { DealerStatsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [CatalogModule],
  controllers: [DealerStatsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
