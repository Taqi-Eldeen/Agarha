import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env';
import { ConsoleEmailProvider, ConsolePushProvider, ConsoleSmsProvider, ConsoleWhatsAppProvider } from './adapters/console';
import { ExpoPushProvider } from './adapters/expo-push';
import { ResendEmailProvider } from './adapters/resend';
import { TwilioSmsProvider } from './adapters/twilio';
import { VonageSmsProvider } from './adapters/vonage';
import { MetaWhatsAppProvider } from './adapters/whatsapp-meta';
import { EMAIL_PROVIDER, PUSH_PROVIDER, SMS_PROVIDERS, WHATSAPP_PROVIDER, type SmsProvider } from './channels';
import { NotificationsService } from './notifications.service';
import { OtpDeliveryService } from './otp-delivery.service';
import { PreferencesController } from './preferences.controller';
import { DeliveryWebhooksController } from './webhooks.controller';

 
@Global()
@Module({
  controllers: [DeliveryWebhooksController, PreferencesController],
  providers: [
    {
      provide: SMS_PROVIDERS,
      inject: [ENV],
      useFactory: (env: Env): SmsProvider[] =>
        env.SMS_PROVIDERS.map((name) =>
          name === 'twilio'
            ? new TwilioSmsProvider(env.TWILIO_ACCOUNT_SID!, env.TWILIO_AUTH_TOKEN!, env.TWILIO_MESSAGING_SERVICE_SID!, env.TWILIO_STATUS_WEBHOOK_URL)
            : name === 'vonage'
              ? new VonageSmsProvider(env.VONAGE_API_KEY!, env.VONAGE_API_SECRET!, env.VONAGE_FROM)
              : new ConsoleSmsProvider(),
        ),
    },
    {
      provide: WHATSAPP_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.WHATSAPP_PROVIDER === 'meta'
          ? new MetaWhatsAppProvider(env.WHATSAPP_PHONE_NUMBER_ID!, env.WHATSAPP_ACCESS_TOKEN!, env.WHATSAPP_GRAPH_VERSION)
          : new ConsoleWhatsAppProvider(),
    },
    {
      provide: PUSH_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) => (env.PUSH_PROVIDER === 'expo' ? new ExpoPushProvider(env.EXPO_ACCESS_TOKEN!) : new ConsolePushProvider()),
    },
    {
      provide: EMAIL_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) => (env.EMAIL_PROVIDER === 'resend' ? new ResendEmailProvider(env.RESEND_API_KEY!, env.EMAIL_FROM) : new ConsoleEmailProvider()),
    },
    OtpDeliveryService,
    NotificationsService,
  ],
  exports: [OtpDeliveryService, NotificationsService],
})
export class NotificationsModule {}
