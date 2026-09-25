import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { Auth, CurrentAuth } from '../../common/auth/guards';
import type { AuthContext } from '../../common/auth/auth-context';
import { ZodBody, ZodPipe } from '../../common/zod';
import { DB, type Database } from '../../db/db';
import { notificationPreferences, pushTokens } from '../../db/schema/notifications';

const TOPICS = [
  'leads',
  'nudges',
  'reviews',
  'saved_searches',
  'availability',
  'marketing',
] as const;
const prefsSchema = z.object({
  preferences: z
    .array(
      z.object({
        topic: z.enum(TOPICS),
        channel: z.enum(['push', 'whatsapp', 'email', 'sms']),
        enabled: z.boolean(),
      }),
    )
    .max(40),
});
const pushTokenSchema = z.object({
  token: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[\w-]+\]$/),
  platform: z.enum(['ios', 'android']),
  locale: z.enum(['ar', 'en']).default('ar'),
});

@ApiTags('notifications')
@Controller('me')
export class PreferencesController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Get('notification-preferences')
  @Auth('customer')
  async list(@CurrentAuth() auth: AuthContext) {
    const rows = await this.db
      .select({
        topic: notificationPreferences.topic,
        channel: notificationPreferences.channel,
        enabled: notificationPreferences.enabled,
      })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, auth.userId));
    return { topics: TOPICS, preferences: rows };
  }

  @Put('notification-preferences')
  @Auth('customer')
  @ZodBody(prefsSchema)
  async update(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(prefsSchema)) body: z.infer<typeof prefsSchema>,
  ) {
    for (const p of body.preferences)
      await this.db
        .insert(notificationPreferences)
        .values({ userId: auth.userId, ...p })
        .onConflictDoUpdate({
          target: [
            notificationPreferences.userId,
            notificationPreferences.topic,
            notificationPreferences.channel,
          ],
          set: { enabled: p.enabled },
        });
    return this.list(auth);
  }

  @Post('push-tokens')
  @HttpCode(204)
  @Auth('customer')
  @ZodBody(pushTokenSchema)
  async register(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(pushTokenSchema)) body: z.infer<typeof pushTokenSchema>,
  ) {
    await this.db
      .insert(pushTokens)
      .values({ userId: auth.userId, ...body })
      .onConflictDoUpdate({
        target: pushTokens.token,
        set: { userId: auth.userId, locale: body.locale, lastSeenAt: new Date() },
      });
  }

  @Delete('push-tokens/:token')
  @HttpCode(204)
  @Auth('customer')
  async unregister(@CurrentAuth() auth: AuthContext, @Param('token') token: string) {
    await this.db
      .delete(pushTokens)
      .where(and(eq(pushTokens.token, token), eq(pushTokens.userId, auth.userId)));
  }
}
