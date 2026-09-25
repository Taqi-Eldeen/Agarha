import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { Errors } from '../../common/errors';
import { DB, type Database } from '../../db/db';
import { REDIS } from '../../infra/redis/redis';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** Liveness: the process is up. */
  @Get()
  live() {
    return { status: 'ok', version: process.env.GIT_SHA ?? 'dev' };
  }

  /** Readiness: DB and Redis reachable. The load balancer and deploy health checks use this. */
  @Get('ready')
  async ready() {
    try {
      await this.db.execute(sql`select 1`);
      await this.redis.ping();
      return { status: 'ready' };
    } catch {
      throw Errors.conflict('not ready');
    }
  }
}
