import { Global, Module } from '@nestjs/common';
import { BRANCH_LISTINGS_CHECK } from '../../common/ports';
import { BillingModule } from '../billing';
import { CatalogModule } from '../catalog';
import { ImportService } from './import.service';
import {
  AdminListingsController,
  DealerListingsController,
  FavoritesController,
} from './listings.controller';
import { ListingsService } from './listings.service';

/** Global only to provide BRANCH_LISTINGS_CHECK to the dealers module without an import cycle. */
@Global()
@Module({
  imports: [CatalogModule, BillingModule],
  controllers: [DealerListingsController, AdminListingsController, FavoritesController],
  providers: [
    ListingsService,
    ImportService,
    {
      provide: BRANCH_LISTINGS_CHECK,
      inject: [ListingsService],
      useFactory: (l: ListingsService) => (branchId: string) => l.branchHasListings(branchId),
    },
  ],
  exports: [ListingsService, BRANCH_LISTINGS_CHECK],
})
export class ListingsModule {}
