import { Module } from '@nestjs/common';
import { RateLimiter } from '../../infra/redis/rate-limiter';
import { LeadsModule } from '../leads';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [LeadsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, RateLimiter],
  exports: [ReviewsService],
})
export class ReviewsModule {}
