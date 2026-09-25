import { dealerStatsSchema } from '@agarha/schemas';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Auth, CurrentDealer } from '../../common/auth/guards';
import { ZodPipe, ZodQuery, ZodResponse } from '../../common/zod';
import { AnalyticsService } from './analytics.service';

type Dealer = { dealerId: string; userId: string; role: 'dealer_owner' | 'dealer_staff' };
const statsQuery = z.object({ days: z.coerce.number().int().min(1).max(90).default(30) });

@ApiTags('dealer')
@Controller('dealer/stats')
export class DealerStatsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  @ZodQuery(statsQuery)
  @ZodResponse(200, dealerStatsSchema)
  stats(
    @CurrentDealer() d: Dealer,
    @Query(new ZodPipe(statsQuery)) q: z.output<typeof statsQuery>,
  ) {
    return this.analytics.dealerStats(d.dealerId, q.days);
  }
}
