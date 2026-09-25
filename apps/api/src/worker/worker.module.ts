import { type DynamicModule, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { coreImports, domainModules } from '../app.module';
import type { Env } from '../config/env';
import { loggerParams } from '../infra/logging';
import { MetricsReporter } from './metrics';
import { Processors } from './processors';

@Module({})
export class WorkerModule {
  static forRoot(env: Env): DynamicModule {
    return { module: WorkerModule, imports: [LoggerModule.forRoot(loggerParams(env)), ...coreImports(env), ...domainModules], providers: [Processors, MetricsReporter] };
  }
}
