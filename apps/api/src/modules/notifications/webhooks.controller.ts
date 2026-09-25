import { Body, Controller, Get, Headers, HttpCode, Inject, Post, Query, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { createHmac } from 'node:crypto';
import { jwtVerify } from 'jose';
import { ENV, type Env } from '../../config/env';
import { hmac, safeEqualHex, sha256 } from '../../common/crypto';
import { Errors } from '../../common/errors';
import { NotificationsService } from './notifications.service';

type RawRequest = Request & { rawBody?: Buffer };

/** Signature-verified delivery reports. Unsigned or badly signed calls get 401 and change nothing. */
@ApiExcludeController()
@Controller('webhooks')
export class DeliveryWebhooksController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly notifications: NotificationsService,
  ) {}

  /** Meta webhook verification handshake. */
  @Get('whatsapp')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    if (
      mode === 'subscribe' &&
      this.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN &&
      token === this.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
    )
      return challenge;
    throw Errors.forbidden();
  }

  @Post('whatsapp')
  @HttpCode(200)
  async whatsapp(
    @Req() req: RawRequest,
    @Headers('x-hub-signature-256') sig?: string,
  ): Promise<{ ok: true }> {
    const secret = this.env.WHATSAPP_APP_SECRET;
    if (!secret || !sig?.startsWith('sha256=') || !req.rawBody)
      throw Errors.unauthorized('Bad signature');
    if (!safeEqualHex(sig.slice(7), hmac(secret, req.rawBody.toString('utf8'))))
      throw Errors.unauthorized('Bad signature');
    const body = req.body as {
      entry?: {
        changes?: {
          value?: { statuses?: { id: string; status: string; errors?: { title?: string }[] }[] };
        }[];
      }[];
    };
    for (const entry of body.entry ?? [])
      for (const change of entry.changes ?? [])
        for (const s of change.value?.statuses ?? []) {
          const status =
            s.status === 'failed'
              ? 'failed'
              : s.status === 'delivered' || s.status === 'read'
                ? 'delivered'
                : 'sent';
          await this.notifications.applyDeliveryStatus(
            'meta-whatsapp',
            s.id,
            status,
            s.errors?.[0]?.title,
          );
        }
    return { ok: true };
  }

  /** Twilio status callback: X-Twilio-Signature = base64(HMAC-SHA1(authToken, url + sorted params)). */
  @Post('sms/twilio')
  @HttpCode(200)
  async twilio(
    @Body() body: Record<string, string>,
    @Headers('x-twilio-signature') sig?: string,
  ): Promise<{ ok: true }> {
    const token = this.env.TWILIO_AUTH_TOKEN;
    const url = this.env.TWILIO_STATUS_WEBHOOK_URL;
    if (!token || !url || !sig) throw Errors.unauthorized('Bad signature');
    const data =
      url +
      Object.keys(body)
        .sort()
        .map((k) => k + body[k])
        .join('');
    const expected = createHmac('sha1', token).update(data).digest('base64');
    if (Buffer.from(expected).length !== Buffer.from(sig).length || expected !== sig)
      throw Errors.unauthorized('Bad signature');
    const status =
      body.MessageStatus === 'delivered'
        ? 'delivered'
        : ['failed', 'undelivered'].includes(body.MessageStatus ?? '')
          ? 'failed'
          : 'sent';
    if (body.MessageSid)
      await this.notifications.applyDeliveryStatus(
        'twilio',
        body.MessageSid,
        status,
        body.ErrorCode,
      );
    return { ok: true };
  }

  /** Vonage signed webhook: Bearer JWT (HS256, signature secret) with payload_hash = sha256(body). */
  @Post('sms/vonage')
  @HttpCode(200)
  async vonage(
    @Req() req: RawRequest,
    @Headers('authorization') auth?: string,
  ): Promise<{ ok: true }> {
    const secret = this.env.VONAGE_SIGNATURE_SECRET;
    if (!secret || !auth?.startsWith('Bearer ') || !req.rawBody)
      throw Errors.unauthorized('Bad signature');
    try {
      const { payload } = await jwtVerify(auth.slice(7), new TextEncoder().encode(secret), {
        algorithms: ['HS256'],
      });
      if (payload.payload_hash !== sha256(req.rawBody.toString('utf8'))) throw new Error('hash');
    } catch {
      throw Errors.unauthorized('Bad signature');
    }
    const body = req.body as {
      messageId?: string;
      'message-id'?: string;
      status?: string;
      'err-code'?: string;
    };
    const id = body.messageId ?? body['message-id'];
    const status =
      body.status === 'delivered'
        ? 'delivered'
        : ['failed', 'rejected', 'expired'].includes(body.status ?? '')
          ? 'failed'
          : 'sent';
    if (id) await this.notifications.applyDeliveryStatus('vonage', id, status, body['err-code']);
    return { ok: true };
  }
}
