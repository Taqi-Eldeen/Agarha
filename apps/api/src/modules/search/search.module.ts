import { Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env';
import { AnalyticsModule } from '../analytics';
import { CatalogModule } from '../catalog';
import { LeadsModule } from '../leads';
import { ReviewsModule } from '../reviews';
import { SEARCH_ENGINES } from './engine';
import { MeiliSearchEngine } from './meili.engine';
import { PostgresSearchEngine } from './postgres.engine';
import { PublicController, SavedController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [CatalogModule, LeadsModule, ReviewsModule, AnalyticsModule],
  controllers: [PublicController, SavedController],
  providers: [
    PostgresSearchEngine,
    {
      provide: SEARCH_ENGINES,
      inject: [PostgresSearchEngine, ENV],
      useFactory: (postgres: PostgresSearchEngine, env: Env) => ({
        postgres,
        meili:
          env.MEILI_HOST && env.MEILI_API_KEY
            ? new MeiliSearchEngine(env.MEILI_HOST, env.MEILI_API_KEY)
            : null,
      }),
    },
    SearchService,
  ],
  exports: [SearchService],
})
export class SearchModule {}
