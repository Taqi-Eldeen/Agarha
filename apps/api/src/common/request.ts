import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface ClientInfo {
  ip: string | undefined;
  userAgent: string | undefined;
  requestId: string;
}

/** req.ip honours TRUST_PROXY_HOPS (Cloudflare + LB). Raw IPs are only used transiently / hashed. */
export const Client = createParamDecorator((_: unknown, ctx: ExecutionContext): ClientInfo => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return { ip: req.ip, userAgent: req.headers['user-agent'], requestId: String(req.id ?? '') };
});
