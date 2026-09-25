// `pnpm db:migrate` in development; the production image runs `node dist/db/migrate.js`.
import { runMigrations } from '../src/db/migrate';

export { runMigrations };

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  runMigrations(url)
    .then(() => console.log('migrations applied'))
    .catch((e: unknown) => {
      console.error(e);
      process.exit(1);
    });
}
