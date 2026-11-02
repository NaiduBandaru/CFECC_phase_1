import { defineConfig } from 'drizzle-kit';
import { config } from './src/config/index.js';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: config.databaseUrl || 'postgresql://postgres:postgres@localhost:5432/postgres',
    ssl: config.databaseUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  },
});
