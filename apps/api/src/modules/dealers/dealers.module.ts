import { Global, Module } from '@nestjs/common';
import { BillingModule } from '../billing';
import { CatalogModule } from '../catalog';
import { IdentityModule, MEMBERSHIP_RESOLVER } from '../identity';
import { VerificationModule } from '../verification';
import { AdminDealersController, DealerPortalController } from './dealers.controller';
import { DealersService } from './dealers.service';

/**
 * Global so identity can resolve MEMBERSHIP_RESOLVER without importing dealers (which would be a cycle).
 */
@Global()
@Module({
  imports: [CatalogModule, VerificationModule, BillingModule, IdentityModule],
  controllers: [DealerPortalController, AdminDealersController],
  providers: [DealersService, { provide: MEMBERSHIP_RESOLVER, useExisting: DealersService }],
  exports: [DealersService, MEMBERSHIP_RESOLVER],
})
export class DealersModule {}
