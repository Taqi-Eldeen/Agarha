import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { loadEnv } from '../config/env';
import { startObservability } from '../infra/observability';
import { Processors } from './processors';
import { WorkerModule } from './worker.module';

/** Worker process: same codebase as the API, BullMQ consumers + scheduled jobs, no HTTP. */
export async function startWorker() {
  const env = loadEnv();
  await startObservability(env, 'worker');
  const app = await NestFactory.createApplicationContext(WorkerModule.forRoot(env), {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  return app;
}

/** `node dist/worker/main.js run <job>` runs one scheduled job and exits (runbooks, manual reruns). */
async function cli() {
  const [cmd, job] = process.argv.slice(2);
  if (cmd === 'run' && job) {
    const env = loadEnv();
    const app = await NestFactory.createApplicationContext(WorkerModule.forRoot(env), {
      logger: ['error', 'warn'],
    });
    const result = await app.get(Processors, { strict: false }).runScheduled(job as never);
    // CLI output for runbooks (`node dist/worker/main.js run <job>`), not a service log.
    console.log(JSON.stringify(result)); // nosemgrep: agarha-no-console-in-api
    await app.close();
    return;
  }
  await startWorker();
}

if (require.main === module) void cli();
