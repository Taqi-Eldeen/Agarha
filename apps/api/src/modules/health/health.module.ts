import { Module } from '@nestjs/common';
import { DevController } from './dev.controller';
import { HealthController } from './health.controller';

@Module({ controllers: [HealthController, DevController] })
export class HealthModule {}
