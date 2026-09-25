// Writes docs/api/openapi.json from the code (no server needed). CI diffs it against main (contract test).
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { configureApp, openApiDocument } from '../src/bootstrap';
import { loadEnv } from '../src/config/env';

async function main() {
  const env = loadEnv({
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://openapi:openapi@127.0.0.1:1/none',
    REDIS_URL: process.env.REDIS_URL ?? 'redis://127.0.0.1:1',
    JWT_SECRET: 'openapi-generation-only-0000000000000000',
    HASH_PEPPER: 'openapi-generation-only-0000000000000000',
    TOTP_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
    TURNSTILE_SECRET_KEY: 'x',
    LOG_LEVEL: 'fatal',
  });
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(env), {
    logger: false,
    abortOnError: false,
    preview: true,
  });
  configureApp(app, env);
  const doc = openApiDocument(app);
  const out = join(__dirname, '..', '..', '..', 'docs', 'api', 'openapi.json');
  writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`wrote ${out} (${Object.keys(doc.paths).length} paths)`);
  process.exit(0);
}

void main();
