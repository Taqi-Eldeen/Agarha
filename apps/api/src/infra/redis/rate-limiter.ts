import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { Errors } from '../../common/errors';
import { REDIS } from './redis';

export interface Limit {
  /** Logical bucket, e.g. "otp:phone". */
  name: string;
  key: string;
  max: number;
  windowSeconds: number;
}

// Fixed window, atomic: INCR and set the expiry on first hit. Returns [count, ttlMs].
const SCRIPT = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return { c, redis.call('PTTL', KEYS[1]) }
`;

@Injectable()
export class RateLimiter {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /** Counts a hit against every limit; throws 429 with Retry-After if any is exceeded. */
  async hit(...limits: Limit[]): Promise<void> {
    for (const l of limits) {
      const [count, ttl] = (await this.redis.eval(
        SCRIPT,
        1,
        `rl:${l.name}:${l.key}`,
        l.windowSeconds * 1000,
      )) as [number, number];
      if (count > l.max) throw Errors.rateLimited(Math.max(1, Math.ceil(ttl / 1000)));
    }
  }

  async reset(name: string, key: string): Promise<void> {
    await this.redis.del(`rl:${name}:${key}`);
  }
}
