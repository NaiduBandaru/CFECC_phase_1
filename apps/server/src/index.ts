import { createApp, setDatabaseReady } from './app.js';
import { config } from './config/index.js';
import { initDatabase, executeRawSql } from './db/index.js';
import { seedDatabase } from './db/seed.js';
import { initBackupScheduler } from './modules/backup/backup.service.js';
import { baileysGateway } from './services/baileys.service.js';

export const app = createApp();

async function bootstrapServer() {
  try {
    console.log('[Server] Initializing database...');
    await initDatabase();

    // Check if initial users exist, if not run seed automatically
    const userCheck = await executeRawSql(`SELECT COUNT(*) as count FROM users`);
    const count = parseInt(userCheck.rows[0]?.count || '0', 10);
    if (count === 0) {
      console.log('[Server] No users detected. Running initial enterprise seed...');
      await seedDatabase();
    } else {
      console.log(`[Server] Database contains ${count} user accounts.`);
    }

    // Open readiness gate to process incoming requests immediately
    setDatabaseReady(true);
    console.log('[Server] Database ready. Readiness gate open.');

    // Initialize automated daily backup daemon
    initBackupScheduler();

    // Auto-connect WhatsApp Gateway if an existing session exists
    baileysGateway.initialize().catch((err) => {
      console.warn('[WhatsApp Gateway] Auto-start notice:', err?.message || err);
    });

    // Start listening on configured port
    app.listen(config.port, () => {
      console.log(`[Server] ====================================================`);
      console.log(`[Server] CFECC Stores Management System API Server running`);
      console.log(`[Server] Port: http://localhost:${config.port}`);
      console.log(`[Server] Location: Visakhapatnam, Andhra Pradesh, India`);
      console.log(`[Server] Environment: ${config.nodeEnv}`);
      console.log(`[Server] ====================================================`);
    });
  } catch (err) {
    console.error('[Server Bootstrap Fatal Error]:', err);
    process.exit(1);
  }
}

bootstrapServer();

export default app;
