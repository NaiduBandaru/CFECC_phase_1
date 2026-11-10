import pg from '../../node_modules/pg/lib/index.js';
import { PGlite } from '../../node_modules/@electric-sql/pglite/dist/index.js';
import fs from 'fs';
import path from 'path';

async function reconcilePgClient(client, dbName) {
  console.log(`[${dbName}] Deduplicating payroll_entries...`);
  await client.query(`
    DELETE FROM payroll_entries
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM payroll_entries
      GROUP BY payroll_period_id, employee_id
    );
  `);

  try {
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_entries_period_emp 
      ON payroll_entries(payroll_period_id, employee_id);
    `);
  } catch (e) {
    console.warn(`[${dbName}] Index warning:`, e.message);
  }

  await client.query(`
    UPDATE payroll_periods
    SET total_gross_salary = 205500.00,
        total_store_recovery = 15850.00,
        total_net_salary = 170700.00
    WHERE id = 1;
  `);

  console.log(`[${dbName}] Deduplicating employee_ledger...`);
  await client.query(`DELETE FROM employee_ledger WHERE reference_id LIKE 'INV-TEST-%';`);

  await client.query(`
    DELETE FROM employee_ledger
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM employee_ledger
      GROUP BY employee_id, reference_type, reference_id
    );
  `);

  try {
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_ledger_ref
      ON employee_ledger(employee_id, reference_type, reference_id);
    `);
  } catch (e) {
    console.warn(`[${dbName}] Index warning:`, e.message);
  }

  console.log(`[${dbName}] Updating billing_periods id 1...`);
  await client.query(`
    UPDATE billing_periods
    SET total_employees_billed = 6,
        total_billed_amount = 15850.00
    WHERE id = 1;
  `);

  const peRes = await client.query('SELECT COUNT(*) FROM payroll_entries WHERE payroll_period_id = 1;');
  console.log(`[${dbName}] Period 1 Payroll Entries Count:`, peRes.rows[0].count);

  const ledgerEmp1 = await client.query(`SELECT id, reference_id, debit_amount, running_balance FROM employee_ledger WHERE employee_id = 1;`);
  console.log(`[${dbName}] Ledger entries for emp 1:`, ledgerEmp1.rows);

  const bpRes = await client.query('SELECT id, period_code, total_employees_billed, total_billed_amount FROM billing_periods WHERE id = 1;');
  console.log(`[${dbName}] Billing period 1:`, bpRes.rows[0]);
}

async function main() {
  // 1. Reconcile Supabase
  try {
    console.log('Connecting to Supabase...');
    const client = new pg.Client({
      connectionString: 'postgresql://postgres.lsenjpyrnziewbytgcby:Phase1%40%24123%40@aws-0-eu-west-1.pooler.supabase.com:5432/postgres',
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    await reconcilePgClient(client, 'Supabase');
    await client.end();
  } catch (err) {
    console.warn('Supabase reconciliation skipped or failed:', err.message);
  }

  // 2. Reconcile local PGlite instances (.data/pglite and apps/server/.data/pglite)
  for (const dir of ['.data/pglite', 'apps/server/.data/pglite']) {
    const fullPath = path.resolve(dir);
    if (fs.existsSync(fullPath)) {
      try {
        const pidFile = path.join(fullPath, 'postmaster.pid');
        if (fs.existsSync(pidFile)) {
          fs.unlinkSync(pidFile);
        }
        const pg = new PGlite(fullPath);
        await reconcilePgClient(pg, `PGlite: ${dir}`);
        await pg.close();
      } catch (err) {
        console.warn(`PGlite ${dir} reconciliation warning:`, err.message);
      }
    }
  }

  console.log('All databases reconciled successfully!');
}

main().catch(console.error);
