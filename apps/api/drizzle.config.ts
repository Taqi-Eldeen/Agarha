import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://agarha:agarha@localhost:5432/agarha',
  },
  extensionsFilters: ['postgis'],
  strict: true,
  verbose: true,
});
