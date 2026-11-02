import { initDatabase } from './index.js';

async function migrate() {
  console.log('[Migration] Ensuring database schema is initialized and up to date...');
  await initDatabase();
  console.log('[Migration] Schema migration completed successfully.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('[Migration] Failed to migrate database:', err);
  process.exit(1);
});

