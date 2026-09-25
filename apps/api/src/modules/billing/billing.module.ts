import { Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { MockGateway, PAYMENT_GATEWAY, PaymobGateway } from './gateway';

@Module({
  controllers: [BillingController],
  providers: [
    BillingService,
    {
      provide: PAYMENT_GATEWAY,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.PAYMENT_GATEWAY === 'paymob'
          ? new PaymobGateway(
              env.PAYMOB_SECRET_KEY!,
              env.PAYMOB_PUBLIC_KEY!,
              env.PAYMOB_HMAC_SECRET!,
              env.PAYMOB_INTEGRATION_IDS.map(Number),
            )
          : new MockGateway(env.MOCK_PAYMENT_WEBHOOK_SECRET, env.PUBLIC_WEB_URL),
    },
  ],
  exports: [BillingService],
})
export class BillingModule {}
