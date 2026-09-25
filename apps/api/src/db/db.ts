import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ENV, type Env } from '../config/env';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
export const DB = Symbol('DB');
export const PG_POOL = Symbol('PG_POOL');

export function createDb(url: string, max = 10): { pool: Pool; db: Database } {
  const pool = new Pool({ connectionString: url, max, application_name: 'agarha-api' });
  return { pool, db: drizzle(pool, { schema, casing: 'snake_case' }) };
}

/**
 * Second line of defence behind the policy layer: runs `fn` as the restricted `agarha_app`
 * role with app.dealer_id set, so Postgres RLS only exposes that dealer's rows.
 */
export async function withDealerRls<T>(db: Database, dealerId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role agarha_app`);
    await tx.execute(sql`select set_config('app.dealer_id', ${dealerId}, true)`);
    return fn(tx);
  });
}

@Injectable()
class PoolCloser implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}
  async onApplicationShutdown() {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: 'DB_BUNDLE',
      inject: [ENV],
      useFactory: (env: Env) => createDb(env.DATABASE_URL, env.DATABASE_POOL_MAX),
    },
    { provide: PG_POOL, inject: ['DB_BUNDLE'], useFactory: (b: { pool: Pool }) => b.pool },
    { provide: DB, inject: ['DB_BUNDLE'], useFactory: (b: { db: Database }) => b.db },
    PoolCloser,
  ],
  exports: [DB, PG_POOL],
})
export class DbModule {}
