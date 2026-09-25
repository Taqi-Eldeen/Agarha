import 'reflect-metadata';
import { SwaggerModule } from '@nestjs/swagger';
import { createApp, openApiDocument } from './bootstrap';
import { loadEnv } from './config/env';
import { startObservability } from './infra/observability';

async function main() {
  const env = loadEnv();
  await startObservability(env, 'api');
  const app = await createApp(env);
  if (env.APP_ENV !== 'production') SwaggerModule.setup('docs', app, openApiDocument(app));
  await app.listen(env.PORT, '0.0.0.0');
}

void main();
