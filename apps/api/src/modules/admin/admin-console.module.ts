import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics';
import { IdentityModule } from '../identity';
import { LeadsModule } from '../leads';
import { AdminConsoleController } from './admin-console.controller';

/** Admin console endpoints that span modules (users, audit, metrics). Imported only by the app root. */
@Module({
  imports: [IdentityModule, AnalyticsModule, LeadsModule],
  controllers: [AdminConsoleController],
})
export class AdminConsoleModule {}
