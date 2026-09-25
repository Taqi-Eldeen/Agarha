import { Client } from 'pg';
import { runMigrations } from './migrate';

/**
 * Per-PR preview databases on the staging instance (CI: .github/workflows/preview.yml).
 *   node dist/db/preview-db.js create agarha_pr_123   → create + migrate
 *   node dist/db/preview-db.js drop agarha_pr_123
 * Names are validated so they can be interpolated as identifiers safely.
 */
export function previewDbName(pr: string | number): string {
  const n = String(pr);
  if (!/^\d{1,7}$/.test(n)) throw new Error(`invalid PR number: ${n}`);
  return `agarha_pr_${n}`;
}

export function withDatabase(url: string, name: string): string {
  const u = new URL(url);
  u.pathname = `/${name}`;
  return u.toString();
}

async function main(cmd: string | undefined, pr: string | undefined) {
  const url = process.env.DATABASE_URL;
  if (!url || !cmd || !pr)
    throw new Error('usage: preview-db.js create|drop <pr-number> (DATABASE_URL = staging owner)');
  const name = previewDbName(pr);
  const admin = new Client({ connectionString: url });
  await admin.connect();
  try {
    if (cmd === 'create') {
      const exists = await admin.query('select 1 from pg_database where datname = $1', [name]);
      if (!exists.rowCount) await admin.query(`create database "${name}"`);
    } else if (cmd === 'drop') {
      await admin.query(`drop database if exists "${name}" with (force)`);
    } else throw new Error(`unknown command ${cmd}`);
  } finally {
    await admin.end();
  }
  if (cmd === 'create') await runMigrations(withDatabase(url, name));
  console.log(`${cmd} ${name}: ok`); // nosemgrep: agarha-no-console-in-api
}

if (require.main === module)
  main(process.argv[2], process.argv[3]).catch((e: unknown) => {
    console.error(e); // nosemgrep: agarha-no-console-in-api
    process.exit(1);
  });
