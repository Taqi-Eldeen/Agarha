import {
  SetMetadata,
  UseInterceptors,
  applyDecorators,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import type { Observable } from 'rxjs';

const PUBLIC_CACHE = 'agarha:public-cache';

/** Public read: cacheable at the edge for 60s (s-maxage), short browser cache, SWR. */
export const PublicCache = (seconds = 60) => SetMetadata(PUBLIC_CACHE, seconds);

/** Everything is `no-store` unless a handler opts into PublicCache. */
@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const seconds = this.reflector.getAllAndOverride<number | undefined>(PUBLIC_CACHE, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const res = ctx.switchToHttp().getResponse<Response>();
    res.setHeader(
      'Cache-Control',
      seconds
        ? `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${seconds * 5}`
        : 'no-store',
    );
    if (seconds) res.setHeader('Vary', 'Accept-Language');
    return next.handle();
  }
}

export const UseCacheControl = () => applyDecorators(UseInterceptors(CacheControlInterceptor));
