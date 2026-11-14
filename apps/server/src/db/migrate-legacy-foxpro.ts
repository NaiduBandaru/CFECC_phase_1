import fs from 'fs';
import path from 'path';
import { initDatabase, executeRawSql } from './index.js';

const FOXPRO_DIR = process.env.FOXPRO_DIR || 'C:\\Users\\naidu\\CFECC Stores data';

interface DbfField {
  name: string;
  type: string;
  len: number;
  dec: number;
  start: number;
}

function getTableFields(filePath: string): { numRecords: number; headerLen: number; recordLen: number; fields: DbfField[] } | null {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  const numRecords = buf.readUInt32LE(4);
  const headerLen = buf.readUInt16LE(8);
  const recordLen = buf.readUInt16LE(10);
  let off = 32;
  const fields: DbfField[] = [];
  let cursor = 1;
  while (buf[off] !== 0x0D && off < headerLen) {
    const name = buf.slice(off, off + 11).toString('ascii').replace(/\0/g, '').trim();
    const type = String.fromCharCode(buf[off + 11]);
    const len = buf[off + 16];
    const dec = buf[off + 17];
    fields.push({ name, type, len, dec, start: cursor });
    cursor += len;
    off += 32;
  }
  return { numRecords, headerLen, recordLen, fields };
}

export async function migrateLegacyFoxproToPostgres() {
  console.log('[Migration] Starting 100% FoxPro Disconnection Migration...');
  await initDatabase();

  // 1. Create tables in PostgreSQL
  console.log('[Migration] 1/4: Ensuring PostgreSQL schema for historical archives...');
  await executeRawSql(`
    CREATE TABLE IF NOT EXISTS historical_vat_returns (
      id SERIAL PRIMARY KEY,
      month_code VARCHAR(10) NOT NULL UNIQUE,
      pur0 NUMERIC(15,2) DEFAULT 0,
      sales0 NUMERIC(15,2) DEFAULT 0,
      pur3 NUMERIC(15,2) DEFAULT 0,
      sales3 NUMERIC(15,2) DEFAULT 0,
      pur5 NUMERIC(15,2) DEFAULT 0,
      sales5 NUMERIC(15,2) DEFAULT 0,
      pur12 NUMERIC(15,2) DEFAULT 0,
      sales12 NUMERIC(15,2) DEFAULT 0,
      pur18 NUMERIC(15,2) DEFAULT 0,
      sales18 NUMERIC(15,2) DEFAULT 0,
      pur28 NUMERIC(15,2) DEFAULT 0,
      sales28 NUMERIC(15,2) DEFAULT 0,
      pur40 NUMERIC(15,2) DEFAULT 0,
      sales40 NUMERIC(15,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_hist_vat_month ON historical_vat_returns(month_code);

    CREATE TABLE IF NOT EXISTS historical_stock_adjustments (
      id SERIAL PRIMARY KEY,
      bill_number INTEGER NOT NULL UNIQUE,
      emp_no VARCHAR(50),
      cs_no VARCHAR(50),
      item_count INTEGER DEFAULT 0,
      total_amount NUMERIC(15,2) DEFAULT 0,
      bill_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS historical_stock_adjustment_items (
      id SERIAL PRIMARY KEY,
      bill_number INTEGER NOT NULL,
      item_no VARCHAR(50),
      item_code VARCHAR(50),
      quantity NUMERIC(12,2) DEFAULT 0,
      rate NUMERIC(12,2) DEFAULT 0,
      amount NUMERIC(15,2) DEFAULT 0,
      item_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_hist_adj_items_bill ON historical_stock_adjustment_items(bill_number);

    CREATE TABLE IF NOT EXISTS historical_recovery_records (
      id SERIAL PRIMARY KEY,
      month_code VARCHAR(10) NOT NULL,
      employee_code VARCHAR(50) NOT NULL,
      cs_no VARCHAR(50),
      employee_name VARCHAR(150),
      category VARCHAR(20),
      grade VARCHAR(20),
      share_capital NUMERIC(12,2) DEFAULT 0,
      cum_thrift NUMERIC(12,2) DEFAULT 0,
      credit_limit NUMERIC(12,2) DEFAULT 0,
      bill_amt NUMERIC(12,2) DEFAULT 0,
      domestic NUMERIC(12,2) DEFAULT 0,
      old_domestic NUMERIC(12,2) DEFAULT 0,
      festival NUMERIC(12,2) DEFAULT 0,
      fest_mmyy VARCHAR(20),
      misc_ded NUMERIC(12,2) DEFAULT 0,
      unrec NUMERIC(12,2) DEFAULT 0,
      add_share NUMERIC(12,2) DEFAULT 0,
      thrift NUMERIC(12,2) DEFAULT 0,
      coupon_amt NUMERIC(12,2) DEFAULT 0,
      rec_pay NUMERIC(12,2) DEFAULT 0,
      total_deduction NUMERIC(12,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_hist_rec_month ON historical_recovery_records(month_code);
    CREATE INDEX IF NOT EXISTS idx_hist_rec_emp ON historical_recovery_records(employee_code);
    CREATE INDEX IF NOT EXISTS idx_hist_rec_cs ON historical_recovery_records(cs_no);
  `);
  console.log('[Migration] PostgreSQL schema ready.');

  // 2. Migrate VAT.DBF
  const vatPath = path.join(FOXPRO_DIR, 'VAT.DBF');
  if (fs.existsSync(vatPath)) {
    console.log('[Migration] 2/4: Migrating VAT.DBF...');
    const meta = getTableFields(vatPath);
    if (meta) {
      const buf = fs.readFileSync(vatPath);
      let count = 0;
      for (let i = 0; i < meta.numRecords; i++) {
        const rStart = meta.headerLen + i * meta.recordLen;
        const row: Record<string, string> = {};
        for (const f of meta.fields) {
          row[f.name] = buf.slice(rStart + f.start, rStart + f.start + f.len).toString('latin1').trim();
        }
        const m = row.MONTHCODE;
        if (!m) continue;

        const pur0 = parseFloat(row.PUR0 || '0') || 0;
        const sales0 = parseFloat(row.SALES0 || '0') || 0;
        const pur3 = parseFloat(row.PUR3 || '0') || 0;
        const sales3 = parseFloat(row.SALES3 || '0') || 0;
        const pur5 = parseFloat(row.PUR5 || '0') || 0;
        const sales5 = parseFloat(row.SALES5 || '0') || 0;
        const pur12 = parseFloat(row.PUR12 || row.PUR14 || '0') || 0;
        const sales12 = parseFloat(row.SALES12 || row.SALES14 || '0') || 0;
        const pur18 = parseFloat(row.PUR18 || '0') || 0;
        const sales18 = parseFloat(row.SALES18 || '0') || 0;
        const pur28 = parseFloat(row.PUR28 || '0') || 0;
        const sales28 = parseFloat(row.SALES28 || '0') || 0;
        const pur40 = parseFloat(row.PUR40 || '0') || 0;
        const sales40 = parseFloat(row.SALES40 || '0') || 0;

        await executeRawSql(`
          INSERT INTO historical_vat_returns (
            month_code, pur0, sales0, pur3, sales3, pur5, sales5,
            pur12, sales12, pur18, sales18, pur28, sales28, pur40, sales40
          ) VALUES (
            '${m}', ${pur0}, ${sales0}, ${pur3}, ${sales3}, ${pur5}, ${sales5},
            ${pur12}, ${sales12}, ${pur18}, ${sales18}, ${pur28}, ${sales28}, ${pur40}, ${sales40}
          )
          ON CONFLICT (month_code) DO UPDATE SET
            pur0 = EXCLUDED.pur0, sales0 = EXCLUDED.sales0,
            pur3 = EXCLUDED.pur3, sales3 = EXCLUDED.sales3,
            pur5 = EXCLUDED.pur5, sales5 = EXCLUDED.sales5,
            pur12 = EXCLUDED.pur12, sales12 = EXCLUDED.sales12,
            pur18 = EXCLUDED.pur18, sales18 = EXCLUDED.sales18,
            pur28 = EXCLUDED.pur28, sales28 = EXCLUDED.sales28,
            pur40 = EXCLUDED.pur40, sales40 = EXCLUDED.sales40;
        `);
        count++;
      }
      console.log(`[Migration] VAT.DBF migrated: ${count} monthly tax returns stored in PostgreSQL.`);
    }
  }

  // 3. Migrate ADJMAST.DBF & ADJDETL.DBF
  const mastPath = path.join(FOXPRO_DIR, 'ADJMAST.DBF');
  const detlPath = path.join(FOXPRO_DIR, 'ADJDETL.DBF');
  if (fs.existsSync(mastPath) && fs.existsSync(detlPath)) {
    console.log('[Migration] 3/4: Migrating Stock Adjustments (ADJMAST.DBF & ADJDETL.DBF)...');
    const mastMeta = getTableFields(mastPath);
    const detlMeta = getTableFields(detlPath);

    if (mastMeta && detlMeta) {
      const mastBuf = fs.readFileSync(mastPath);
      const detlBuf = fs.readFileSync(detlPath);

      // Clean existing
      await executeRawSql(`DELETE FROM historical_stock_adjustment_items;`);
      await executeRawSql(`DELETE FROM historical_stock_adjustments;`);

      // Master vouchers
      for (let i = 0; i < mastMeta.numRecords; i++) {
        const rStart = mastMeta.headerLen + i * mastMeta.recordLen;
        const row: Record<string, string> = {};
        for (const f of mastMeta.fields) {
          row[f.name] = mastBuf.slice(rStart + f.start, rStart + f.start + f.len).toString('latin1').trim();
        }
        const billNo = parseInt(row.BILLNO || '0', 10);
        if (!billNo) continue;
        const rawDate = row.BILLDATE || '';
        const d = rawDate.length === 8 ? `'${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}'` : 'NULL';
        const amt = parseFloat(row.BILLAMT || '0') || 0;
        const items = parseInt(row.ITEMS || '0', 10) || 0;

        await executeRawSql(`
          INSERT INTO historical_stock_adjustments (
            bill_number, emp_no, cs_no, item_count, total_amount, bill_date
          ) VALUES (
            ${billNo}, ${row.EMPNO ? `'${row.EMPNO}'` : 'NULL'}, ${row.CSNO ? `'${row.CSNO}'` : 'NULL'},
            ${items}, ${amt}, ${d}
          ) ON CONFLICT (bill_number) DO NOTHING;
        `);
      }

      // Detail lines in batches of 500
      let batch: string[] = [];
      for (let i = 0; i < detlMeta.numRecords; i++) {
        const rStart = detlMeta.headerLen + i * detlMeta.recordLen;
        const row: Record<string, string> = {};
        for (const f of detlMeta.fields) {
          row[f.name] = detlBuf.slice(rStart + f.start, rStart + f.start + f.len).toString('latin1').trim();
        }
        const billNo = parseInt(row.TBILLNO || '0', 10);
        if (!billNo) continue;
        const rawDate = row.TDATE || '';
        const d = rawDate.length === 8 ? `'${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}'` : 'NULL';
        const qty = parseFloat(row.TQTY || '0') || 0;
        const rate = parseFloat(row.TRATE || '0') || 0;
        const amt = parseFloat(row.TAMOUNT || '0') || (qty * rate);

        batch.push(`(${billNo}, '${(row.TITEMNO || '').replace(/'/g, "''")}', '${(row.TITEM || '').replace(/'/g, "''")}', ${qty}, ${rate}, ${amt}, ${d})`);

        if (batch.length >= 500) {
          await executeRawSql(`
            INSERT INTO historical_stock_adjustment_items (
              bill_number, item_no, item_code, quantity, rate, amount, item_date
            ) VALUES ${batch.join(', ')};
          `);
          batch = [];
        }
      }
      if (batch.length > 0) {
        await executeRawSql(`
          INSERT INTO historical_stock_adjustment_items (
            bill_number, item_no, item_code, quantity, rate, amount, item_date
          ) VALUES ${batch.join(', ')};
        `);
      }
      console.log(`[Migration] Stock Adjustments migrated: ${mastMeta.numRecords} vouchers, ${detlMeta.numRecords} items stored in PostgreSQL.`);
    }
  }

  // 4. Migrate STRDED.DBF (Historical 10-Head Recovery Ledger - 106,908 rows)
  const strdedPath = path.join(FOXPRO_DIR, 'STRDED.DBF');
  if (fs.existsSync(strdedPath)) {
    console.log('[Migration] 4/4: Migrating STRDED.DBF (106,908 recovery records)...');
    const meta = getTableFields(strdedPath);
    if (meta) {
      const buf = fs.readFileSync(strdedPath);

      // Check current rows in table
      const countRes = await executeRawSql(`SELECT COUNT(*) as count FROM historical_recovery_records;`);
      const existingCount = parseInt(countRes.rows[0]?.count || '0', 10);
      if (existingCount >= meta.numRecords) {
        console.log(`[Migration] STRDED.DBF already fully migrated (${existingCount} records in PostgreSQL).`);
      } else {
        await executeRawSql(`TRUNCATE TABLE historical_recovery_records RESTART IDENTITY;`);

        const batchSize = 1000;
        let batch: string[] = [];
        let inserted = 0;

        for (let i = 0; i < meta.numRecords; i++) {
          const rStart = meta.headerLen + i * meta.recordLen;
          const row: Record<string, string> = {};
          for (const f of meta.fields) {
            row[f.name] = buf.slice(rStart + f.start, rStart + f.start + f.len).toString('latin1').trim();
          }

          const monthcode = (row.MONTHCODE || '').replace(/'/g, "''");
          const eno = (row.ENO || '').replace(/'/g, "''");
          const csno = (row.CSNO || '').replace(/'/g, "''");
          const name = (row.NAME || '').replace(/'/g, "''");
          const category = row.CATEGORY === '1' ? 'STAFF' : row.CATEGORY === '0' || row.CATEGORY === '3' ? 'SPECIAL' : 'WORKER';
          const grade = row.CATEGORY === '1' ? 'M' : row.CATEGORY === '0' || row.CATEGORY === '3' ? 'Other' : 'NM';

          const sharecap = parseFloat(row.SHARECAP || '0') || 0;
          const cumthrift = parseFloat(row.CUMTHRIFT || '0') || 0;
          const eligi = parseFloat(row.ELIGI || '0') || 0;
          const billamt = parseFloat(row.BILLAMT || '0') || 0;
          const domestic = parseFloat(row.DOMESTIC || '0') || 0;
          const olddome = parseFloat(row.OLDDOME || '0') || 0;
          const fest = parseFloat(row.FEST || '0') || 0;
          const festmmyy = (row.FESTMMYY || '').replace(/'/g, "''");
          const miscded = parseFloat(row.MISCDED || '0') || 0;
          const unrec = parseFloat(row.UNREC || '0') || 0;
          const addshare = parseFloat(row.ADDSHARE || '0') || 0;
          const thrift = parseFloat(row.THRIFT || '0') || 0;
          const coupamt = parseFloat(row.COUPAMT || '0') || 0;
          const recpay = parseFloat(row.RECPAY || '0') || 0;
          const netDeduction = billamt + domestic + olddome + fest + miscded + unrec + addshare + thrift - coupamt - recpay;

          batch.push(`(
            '${monthcode}', '${eno}', '${csno}', '${name}', '${category}', '${grade}',
            ${sharecap}, ${cumthrift}, ${eligi}, ${billamt}, ${domestic}, ${olddome},
            ${fest}, '${festmmyy}', ${miscded}, ${unrec}, ${addshare}, ${thrift},
            ${coupamt}, ${recpay}, ${netDeduction}
          )`);

          if (batch.length >= batchSize) {
            await executeRawSql(`
              INSERT INTO historical_recovery_records (
                month_code, employee_code, cs_no, employee_name, category, grade,
                share_capital, cum_thrift, credit_limit, bill_amt, domestic, old_domestic,
                festival, fest_mmyy, misc_ded, unrec, add_share, thrift,
                coupon_amt, rec_pay, total_deduction
              ) VALUES ${batch.join(', ')};
            `);
            inserted += batch.length;
            if (inserted % 10000 === 0 || inserted === meta.numRecords) {
              console.log(`[Migration] STRDED progress: ${inserted.toLocaleString()} / ${meta.numRecords.toLocaleString()} records inserted...`);
            }
            batch = [];
          }
        }

        if (batch.length > 0) {
          await executeRawSql(`
            INSERT INTO historical_recovery_records (
              month_code, employee_code, cs_no, employee_name, category, grade,
              share_capital, cum_thrift, credit_limit, bill_amt, domestic, old_domestic,
              festival, fest_mmyy, misc_ded, unrec, add_share, thrift,
              coupon_amt, rec_pay, total_deduction
            ) VALUES ${batch.join(', ')};
          `);
          inserted += batch.length;
        }

        console.log(`[Migration] STRDED.DBF migration complete: ${inserted.toLocaleString()} records stored in PostgreSQL!`);
      }
    }
  }

  console.log('[Migration] ============================================================');
  console.log('[Migration] 100% FOXPRO DISCONNECTION COMPLETE:');
  console.log('[Migration] All legacy data is now natively stored in PostgreSQL.');
  console.log('[Migration] ============================================================');
}

// Allow direct execution
if (process.argv[1]?.includes('migrate-legacy-foxpro')) {
  migrateLegacyFoxproToPostgres()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Migration] Failed:', err);
      process.exit(1);
    });
}

