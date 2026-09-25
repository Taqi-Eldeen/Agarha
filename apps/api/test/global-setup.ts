/* eslint-disable no-console */
import { runMigrations } from '../scripts/migrate';

/**
 * Uses TEST_DATABASE_URL / TEST_REDIS_URL when provided (local services, CI service containers);
 * otherwise starts PostGIS + Redis with Testcontainers.
 */
export default async function setup(): Promise<void> {
  let db = process.env.TEST_DATABASE_URL;
  let redis = process.env.TEST_REDIS_URL;
  if (!db || !redis) {
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
    const { RedisContainer } = await import('@testcontainers/redis');
    const pg = await new PostgreSqlContainer('postgis/postgis:16-3.4').withDatabase('agarha_test').withUsername('agarha').withPassword('agarha').start();
    const rd = await new RedisContainer('redis:7-alpine').start();
    db = pg.getConnectionUri();
    redis = rd.getConnectionUrl();
    (globalThis as { __containers?: unknown[] }).__containers = [pg, rd];
  }
  process.env.TEST_DATABASE_URL = db;
  process.env.TEST_REDIS_URL = redis;
  await runMigrations(db);
  console.log('\n[integration] database migrated');
}
