import { type DynamicModule, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AuthCoreModule } from './common/auth/auth.module';
import { ENV, type Env } from './config/env';
import { DbModule } from './db/db';
import { EventsModule } from './infra/events';
import { FlagsModule } from './infra/flags';
import { loggerParams } from './infra/logging';
import { MapsModule } from './infra/maps';
import { PrivacyModule } from './infra/privacy';
import { QueueModule } from './infra/queue/queues';
import { RedisModule } from './infra/redis/redis';
import { DevStorageController } from './infra/storage/dev-storage.controller';
import { StorageModule } from './infra/storage/storage';
import { AdminModule } from './modules/admin';
import { AdminConsoleModule } from './modules/admin/admin-console.module';
import { AnalyticsModule } from './modules/analytics';
import { BillingModule } from './modules/billing';
import { CatalogModule } from './modules/catalog';
import { DealersModule } from './modules/dealers';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity';
import { LeadsModule } from './modules/leads';
import { ListingsModule } from './modules/listings';
import { ModerationModule } from './modules/moderation';
import { NotificationsModule } from './modules/notifications';
import { ReviewsModule } from './modules/reviews';
import { SearchModule } from './modules/search';
import { VerificationModule } from './modules/verification';

@Module({})
class ConfigModule {
  static forRoot(env: Env): DynamicModule {
    return { module: ConfigModule, global: true, providers: [{ provide: ENV, useValue: env }], exports: [ENV] };
  }
}

/** Shared infrastructure, used by both the HTTP app and the worker process. */
export function coreImports(env: Env) {
  return [
    ConfigModule.forRoot(env),
    DbModule,
    RedisModule,
    QueueModule,
    EventsModule,
    StorageModule,
    FlagsModule,
    MapsModule,
    PrivacyModule,
    AuthCoreModule,
    AdminModule,
    NotificationsModule,
  ];
}

/** Every domain module (section 6). */
export const domainModules = [
  IdentityModule,
  CatalogModule,
  VerificationModule,
  BillingModule,
  DealersModule,
  ListingsModule,
  LeadsModule,
  ReviewsModule,
  ModerationModule,
  AnalyticsModule,
  SearchModule,
];

@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [LoggerModule.forRoot(loggerParams(env)), ...coreImports(env), ...domainModules, AdminConsoleModule, HealthModule],
      controllers: env.STORAGE_DRIVER === 'local' ? [DevStorageController] : [],
    };
  }
}
