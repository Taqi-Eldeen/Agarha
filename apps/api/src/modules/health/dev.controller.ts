import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ENV, type Env } from '../../config/env';
import { Errors } from '../../common/errors';
import { Outbox } from '../notifications';

/** Local/test only: read what the mock adapters "sent" (OTP codes, WhatsApp alerts). */
@ApiExcludeController()
@Controller('dev')
export class DevController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  @Get('outbox')
  outbox(@Query('to') to?: string) {
    if (this.env.APP_ENV !== 'local' && this.env.NODE_ENV !== 'test') throw Errors.notFound('Route');
    return { items: Outbox.entries.filter((e) => !to || e.to === to).slice(-50).reverse() };
  }
}
