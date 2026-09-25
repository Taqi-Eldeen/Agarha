import type { INestApplication } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { text } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { CacheControlInterceptor } from './common/cache';
import { ErrorFilter } from './common/error.filter';
import type { Env } from './config/env';

export async function createApp(env: Env): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(env), {
    bufferLogs: true,
    rawBody: true,
  });
  app.useLogger(app.get(Logger));
  configureApp(app, env);
  return app;
}

/** HTTP pipeline shared by main.ts and the integration tests. */
export function configureApp(app: NestExpressApplication, env: Env): void {
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      hsts: { maxAge: 63_072_000, includeSubDomains: true, preload: true },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());
  app.use('/v1/dealer/listings/import', text({ type: 'text/csv', limit: '1mb' }));
  app.useBodyParser('json', { limit: '200kb' });
  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    maxAge: 600,
    exposedHeaders: ['Retry-After', 'Idempotent-Replayed'],
  });
  app.setGlobalPrefix('v1');
  app.useGlobalFilters(new ErrorFilter());
  // Everything is Cache-Control: no-store unless a handler opts into @PublicCache.
  app.useGlobalInterceptors(new CacheControlInterceptor(app.get(Reflector)));
  app.enableShutdownHooks();
}

export function openApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Agarha API')
    .setDescription(
      'Car-rental listings platform for Egypt. Errors: { code, message, details, requestId }. Cursor pagination. Idempotency-Key on creates.',
    )
    .setVersion('1.0.0')
    .addServer('/')
    .addBearerAuth()
    .addCookieAuth('ag_c_at')
    .build();
  return SwaggerModule.createDocument(app, config);
}
