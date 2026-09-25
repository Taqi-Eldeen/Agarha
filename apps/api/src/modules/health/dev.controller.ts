import { Controller, Get, HttpCode, Inject, Post, Query } from '@nestjs/common';
import type Redis from 'ioredis';
import { ApiExcludeController } from '@nestjs/swagger';
import { ENV, type Env } from '../../config/env';
import { Errors } from '../../common/errors';
import { REDIS } from '../../infra/redis/redis';
import { Outbox } from '../notifications';

/** Local/test only: read what the mock adapters "sent" (OTP codes, WhatsApp alerts). */
@ApiExcludeController()
@Controller('dev')
export class DevController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  private guard() {
    if (this.env.APP_ENV !== 'local' && this.env.NODE_ENV !== 'test')
      throw Errors.notFound('Route');
  }

  @Get('outbox')
  outbox(@Query('to') to?: string) {
    this.guard();
    return {
      items: Outbox.entries
        .filter((e) => !to || e.to === to)
        .slice(-50)
        .reverse(),
    };
  }

  /** E2E setup: clear rate-limit counters so repeated local runs don't hit 429s. */
  @Post('reset-limits')
  @HttpCode(204)
  async resetLimits() {
    this.guard();
    const keys = await this.redis.keys('rl:*');
    if (keys.length) await this.redis.del(...keys);
  }
}
