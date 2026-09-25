import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog';
import { RateLimiter } from '../../infra/redis/rate-limiter';
import { AvailabilityService } from './availability.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({ imports: [CatalogModule], controllers: [LeadsController], providers: [LeadsService, AvailabilityService, RateLimiter], exports: [LeadsService, AvailabilityService] })
export class LeadsModule {}
