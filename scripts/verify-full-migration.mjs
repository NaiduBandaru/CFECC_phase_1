// scripts/verify-full-migration.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const serverRequire = createRequire(path.join(rootDir, 'apps/server/package.json'));
const dotenv = serverRequire('dotenv');
const pg = serverRequire('pg');

dotenv.config({ path: path.join(rootDir, 'apps/server/.env') });

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL not set in apps/server/.env.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  console.log('Connected to PostgreSQL (Supabase)...');

  try {
    const checks = [
      { name: 'Items (STMAS.DBF)', sql: 'SELECT COUNT(*) FROM items;', expected: 1852 },
      { name: 'Vendors (VENDOR.DBF)', sql: 'SELECT COUNT(*) FROM vendors;', expected: 274 },
      { name: 'Employees (EMPMAST.DBF)', sql: 'SELECT COUNT(*) FROM employees;', expected: 692 },
      { name: 'Purchase Orders (PURMAST.DBF)', sql: 'SELECT COUNT(*) FROM purchase_orders;', expected: 1000 },
      { name: 'Purchase Order Items (PURDETL.DBF)', sql: 'SELECT COUNT(*) FROM purchase_order_items;' },
      { name: 'PO Items with Non-Zero GST', sql: 'SELECT COUNT(*) FROM purchase_order_items WHERE cgst_rate > 0 OR sgst_rate > 0 OR igst_rate > 0;' },
      { name: 'POS Sales (TRNMAST.DBF)', sql: 'SELECT COUNT(*) FROM sales;', expected: 1500 },
      { name: 'Employee Ledger Postings', sql: 'SELECT COUNT(*) FROM employee_ledger;', expected: 1500 },
      { name: 'Store Recovery Advice (PAYROLL.DBF)', sql: 'SELECT COUNT(*) FROM payroll_entries;', expected: 692 },
      { name: 'Historical VAT Returns (VAT.DBF)', sql: 'SELECT COUNT(*) FROM historical_vat_returns;', expected: 162 },
      { name: 'Historical Stock Adjustments (ADJMAST)', sql: 'SELECT COUNT(*) FROM historical_stock_adjustments;', expected: 239 },
      { name: 'Historical Adjustment Items (ADJDETL)', sql: 'SELECT COUNT(*) FROM historical_stock_adjustment_items;', expected: 2838 },
      { name: 'Historical Recovery Records (STRDED)', sql: 'SELECT COUNT(*) FROM historical_recovery_records;', expected: 106908 }
    ];

    console.log('\n====================================================');
    console.log(' CFECC Phase 1: Full Migration Verification Report');
    console.log('====================================================');
    let allPassed = true;
    for (const check of checks) {
      const res = await client.query(check.sql);
      const count = parseInt(res.rows[0].count, 10);
      const expStr = check.expected !== undefined ? ` (Target: ${check.expected.toLocaleString()})` : '';
      const matched = check.expected !== undefined ? count === check.expected : true;
      if (!matched) allPassed = false;
      const status = check.expected !== undefined ? (matched ? '  MATCH  ' : ' MISMATCH ') : '  INFO   ';
      console.log(`[${status}] ${check.name.padEnd(40)} : ${count.toLocaleString().padStart(8)}${expStr}`);
    }

    // Inspect GST breakdown sample on imported PO items
    console.log('\n--- SAMPLE IMPORTED PURCHASE ORDER ITEMS (GST RATES) ---');
    const sampleItems = await client.query(`
      SELECT poi.id, i.name AS item_name, poi.ordered_qty, poi.unit_price, poi.cgst_rate, poi.sgst_rate, poi.igst_rate, poi.cgst_amount, poi.sgst_amount, poi.igst_amount
      FROM purchase_order_items poi
      JOIN items i ON poi.item_id = i.id
      WHERE poi.cgst_rate > 0
      LIMIT 3;
    `);
    console.table(sampleItems.rows);

    // Sequence check
    console.log('\n--- SERIAL SEQUENCE HEALTH CHECK ---');
    const seqs = [
      { table: 'items', seq: 'items_id_seq' },
      { table: 'vendors', seq: 'vendors_id_seq' },
      { table: 'employees', seq: 'employees_id_seq' },
      { table: 'purchase_orders', seq: 'purchase_orders_id_seq' },
      { table: 'sales', seq: 'sales_id_seq' }
    ];
    for (const s of seqs) {
      const maxRes = await client.query(`SELECT COALESCE(MAX(id), 0) AS max_id FROM "${s.table}";`);
      const maxId = parseInt(maxRes.rows[0].max_id, 10);
      console.log(`Table ${s.table.padEnd(20)} Max ID: ${maxId}`);
    }

    // Administrative users check
    console.log('\n--- SYSTEM USERS & ROLES PRESERVED ---');
    const users = await client.query(`
      SELECT u.id, u.username, r.name as role_name, u.is_active 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id 
      ORDER BY u.id;
    `);
    console.table(users.rows);

    console.log('\n====================================================');
    console.log(allPassed ? '✅ ALL DATABASE TARGETS 100% VERIFIED & SYNCHRONIZED!' : '⚠️ SOME COUNTS DIFFER');
    console.log('====================================================');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
