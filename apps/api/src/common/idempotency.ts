import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
  UseInterceptors,
  applyDecorators,
} from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type Redis from 'ioredis';
import { from, of, type Observable } from 'rxjs';
import { mergeMap, tap } from 'rxjs/operators';
import { REDIS } from '../infra/redis/redis';
import { sha256 } from './crypto';
import { Errors } from './errors';

const TTL_SECONDS = 86_400;

/**
 * Idempotency-Key on create endpoints. The first response (status + body) is stored for 24h
 * and replayed for retries with the same key and the same body; a different body is a 409.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || !key) return next.handle();
    if (key.length > 128) throw Errors.badRequest('validation_failed', 'Idempotency-Key too long');

    const owner = req.auth?.userId ?? sha256(req.ip ?? 'anon');
    const redisKey = `idem:${req.method}:${req.route?.path ?? req.path}:${owner}:${key}`;
    const fingerprint = sha256(JSON.stringify(req.body ?? {}));

    return from(
      this.redis.set(
        redisKey,
        JSON.stringify({ state: 'pending', fingerprint }),
        'EX',
        TTL_SECONDS,
        'NX',
      ),
    ).pipe(
      mergeMap((acquired) => {
        if (acquired) {
          return next.handle().pipe(
            tap({
              next: (body) =>
                void this.redis.set(
                  redisKey,
                  JSON.stringify({ state: 'done', fingerprint, status: res.statusCode, body }),
                  'EX',
                  TTL_SECONDS,
                ),
              error: () => void this.redis.del(redisKey),
            }),
          );
        }
        return from(this.redis.get(redisKey)).pipe(
          mergeMap((raw) => {
            const saved = raw
              ? (JSON.parse(raw) as {
                  state: string;
                  fingerprint: string;
                  status?: number;
                  body?: unknown;
                })
              : null;
            if (!saved) return next.handle();
            if (saved.fingerprint !== fingerprint)
              throw Errors.conflict('Idempotency-Key was used with a different request');
            if (saved.state === 'pending')
              throw Errors.conflict('A request with this Idempotency-Key is in progress');
            res.status(saved.status ?? 200);
            res.setHeader('Idempotent-Replayed', 'true');
            return of(saved.body);
          }),
        );
      }),
    );
  }
}

export const Idempotent = () =>
  applyDecorators(
    UseInterceptors(IdempotencyInterceptor),
    ApiHeader({
      name: 'Idempotency-Key',
      required: false,
      description: 'Retries with the same key return the original response.',
    }),
  );
