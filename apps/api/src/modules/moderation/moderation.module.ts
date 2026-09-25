import { Module } from '@nestjs/common';
import { RateLimiter } from '../../infra/redis/rate-limiter';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';

@Module({ controllers: [ModerationController], providers: [ModerationService, RateLimiter], exports: [ModerationService] })
export class ModerationModule {}
