import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics';
import { IdentityModule } from '../identity';
import { AdminConsoleController } from './admin-console.controller';

/** Admin console endpoints that span modules (users, audit, metrics). Imported only by the app root. */
@Module({ imports: [IdentityModule, AnalyticsModule], controllers: [AdminConsoleController] })
export class AdminConsoleModule {}
