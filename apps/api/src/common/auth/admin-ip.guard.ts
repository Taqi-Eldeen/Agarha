import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { BlockList, isIPv6 } from 'node:net';
import { ENV, type Env } from '../../config/env';
import { Errors } from '../errors';

/** IP allowlist for every admin endpoint (and admin sign-in). Empty list = open (local/test only). */
@Injectable()
export class AdminIpGuard implements CanActivate {
  private readonly list: BlockList | null;
  constructor(@Inject(ENV) env: Env) {
    if (!env.ADMIN_IP_ALLOWLIST.length) {
      this.list = null;
      return;
    }
    this.list = new BlockList();
    for (const entry of env.ADMIN_IP_ALLOWLIST) {
      const [net, bits] = entry.split('/');
      const type = isIPv6(net!) ? 'ipv6' : 'ipv4';
      if (bits) this.list.addSubnet(net!, Number(bits), type);
      else this.list.addAddress(net!, type);
    }
  }

  canActivate(ctx: ExecutionContext): boolean {
    if (!this.list) return true;
    const ip = (ctx.switchToHttp().getRequest<Request>().ip ?? '').replace(/^::ffff:/, '');
    if (!ip || !this.list.check(ip, isIPv6(ip) ? 'ipv6' : 'ipv4'))
      throw Errors.forbidden('Admin access is restricted by IP');
    return true;
  }
}
