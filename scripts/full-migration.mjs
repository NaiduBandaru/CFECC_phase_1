import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const serverRequire = createRequire(path.join(rootDir, 'apps/server/package.json'));
const { PGlite } = serverRequire('@electric-sql/pglite');

async function runSafetyBackup() {
  console.log('\n[Safety Step 1/3] Creating Pre-Migration Database Snapshot...');
  const dataDir = path.join(rootDir, '.data', 'pglite');
  const backupDir = path.join(rootDir, 'apps/server', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `safety-backup-pre-migration-${timestamp}.json`);

  const pglite = new PGlite(dataDir);
  try {
    const tables = [
      'roles', 'permissions', 'departments', 'designations', 'users',
      'item_categories', 'units', 'items', 'vendors', 'purchase_orders',
      'purchase_order_items', 'goods_receipts', 'goods_receipt_items',
      'purchase_invoices', 'employees', 'sales', 'sale_items', 'employee_ledger'
    ];
    const snapshot = {
      createdAt: new Date().toISOString(),
      tables: {}
    };

    for (const t of tables) {
      try {
        const res = await pglite.query(`SELECT * FROM "${t}"`);
        snapshot.tables[t] = res.rows || [];
      } catch {
        snapshot.tables[t] = [];
      }
    }

    fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 2), 'utf-8');
    console.log(`✓ Safety backup created: ${backupFile}`);
  } finally {
    await pglite.close();
  }
}

async function main() {
  console.log('====================================================');
  console.log(' CFECC Phase 1: COMPLETE DATABASE RESET & MIGRATION');
  console.log('====================================================');

  await runSafetyBackup();

  console.log('\n[Migration Step 2/3] Running Core Master & Operational Ingest...');
  const { execSync } = await import('child_process');
  
  // 1. Run core import
  execSync('node scripts/import-foxpro-data.mjs', {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env
  });

  console.log('\n[Migration Step 3/3] Ingesting Historical Archives (VAT, Adjustments, STRDED)...');
  // 2. Run historical legacy migration
  execSync('pnpm --filter @cfecc/server exec tsx src/db/migrate-legacy-foxpro.ts', {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env
  });

  console.log('\n====================================================');
  console.log('✅ FULL FRESH MIGRATION FINISHED SUCCESSFULLY!');
  console.log('====================================================\n');
}

main().catch(err => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
